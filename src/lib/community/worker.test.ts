import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import dotenv from "dotenv";
import { MongoClient, type Db } from "mongodb";
import { CommunityWorker, WORKER_LEASE_MS } from "./worker";
import { CommunityService, ProviderError, freshJob } from "./service";
import { MongoCommunityRepository } from "./mongo-repository";
import type { Contact, Providers } from "./model";

dotenv.config({ path: ".env.local", quiet: true }); dotenv.config({ path: ".env", quiet: true });
describe("Durable Discord recovery worker", { skip: process.env.COMMUNITY_MONGO_TEST !== "1" }, () => {
  let client: MongoClient; let db: Db; const prefixes: string[] = [];
  const destination = { guildId: "1556786037307613317", roleId: "1556786037307613302", segmentId: "worker-test-segment" };
  const id = `${destination.guildId}:${destination.roleId}:${destination.segmentId}`;
  const prefix = () => { const value = `communityWorkerSpec${randomUUID().replaceAll("-", "")}`; prefixes.push(value); return value; };
  before(async () => {
    if (process.env.MONGODB_DB !== "blueprint_dev" || !process.env.MONGODB_URI) throw new Error("Worker tests require the development database");
    client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    await client.connect(); db = client.db("blueprint_dev");
  });
  after(async () => {
    if (db) for (const owned of prefixes) for (const suffix of ["WorkerState", "VerificationFlows", "Contacts", "Limits", "TrustedMembers"]) {
      await db.collection(`${owned}${suffix}`).drop().catch(error => { if (error.codeName !== "NamespaceNotFound") throw error; });
    }
    if (client) await client.close();
  });
  test("automatic recovery resumes delayed role/list jobs without another email or browser", async () => {
    const owned = prefix(); let now = new Date(); let code = ""; let emails = 0; let grants = 0; let lists = 0; let outage = true;
    const repo = new MongoCommunityRepository(db, owned);
    const providers: Providers = {
      async identity() { return { id: "1556786037307613303", name: "Worker Test" }; }, async member() { return { pending: false }; },
      async email(_email, value) { code = value; emails++; },
      async role() { if (outage) throw new ProviderError("Discord busy", true, 120); grants++; },
      async subscribe() { lists++; return { id: "mock-contact", unsubscribed: true }; },
    };
    const service = new CommunityService(repo, providers, "worker-test-secret", destination, undefined, () => now);
    const worker = new CommunityWorker(db, owned, destination, service, () => now);
    const flow = await service.start("worker-test"); await service.callback(flow.token, flow.state, "mock-oauth");
    await service.send(flow.token, "worker@example.test", "worker-test", true); await service.confirm(flow.token, code, "worker-test");
    assert.equal((await worker.run()).jobs.pendingContacts, 1);
    outage = false; now = new Date(now.getTime() + 60_000); await worker.run(); assert.equal(grants, 0);
    now = new Date(now.getTime() + 60_000); await worker.run();
    assert.equal(grants, 1); assert.equal(lists, 1); assert.equal(emails, 1);
    const status = await worker.status(); assert.equal(status.jobs.pendingContacts, 0); assert.equal(status.running, false);
    assert.ok(status.lastSucceededAt); assert.ok(!JSON.stringify(status).includes("worker@example.test"));
    assert.equal((await worker.run()).processed, 0);
    assert.equal((await repo.contact("worker@example.test"))?.unsubscribed, true);
  });
  test("separate worker instances cannot overlap and an abandoned lease becomes recoverable", async () => {
    const owned = prefix(); let now = new Date(); let calls = 0; let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const processor = { async processDue() { calls++; if (calls === 1) await blocked; return calls === 1 ? 1 : 2; } };
    const first = new CommunityWorker(db, owned, destination, processor, () => now);
    const second = new CommunityWorker(db, owned, destination, { async processDue() { return 2; } }, () => now);
    const running = first.run();
    // Wait for the lease write, not for any wall-clock timeout.
    for (let attempt = 0; attempt < 50; attempt++) { if ((await first.status()).running) break; }
    assert.equal((await second.run()).skipped, "already_running"); assert.equal(calls, 1);
    now = new Date(now.getTime() + WORKER_LEASE_MS); assert.equal((await second.run()).processed, 2);
    release(); await running;
    assert.equal((await db.collection<{ _id: string; lastProcessed: number }>(`${owned}WorkerState`).findOne({ _id: id }))?.lastProcessed, 2);
    assert.equal((await first.status()).running, false);
  });
  test("a slow role stage defers list sync to the next run within the hosting budget", async () => {
    const owned = prefix(); let now = new Date(); let grants = 0; let lists = 0;
    const repo = new MongoCommunityRepository(db, owned);
    const sample: Contact = { _id: "budget", email: "budget@example.test", createdAt: now, verifiedAt: now,
      enrollmentVersion: 1, enrollmentAcceptedAt: now, ...destination, discordId: "1556786037307613303",
      state: "active", lastVerificationFlowId: "mock-flow", generation: 1, roleJob: freshJob(now), listJob: freshJob(now) };
    await db.collection<Contact>(`${owned}Contacts`).insertOne(sample);
    const providers: Providers = {
      async identity() { throw new Error("No new OAuth expected"); }, async email() { throw new Error("No email expected"); },
      async member() { return { pending: false }; },
      async role() { grants++; now = new Date(now.getTime() + 15_000); },
      async subscribe() { lists++; return { id: "mock-contact", unsubscribed: false }; },
    };
    const service = new CommunityService(repo, providers, "worker-test-secret", destination, undefined, () => now);
    const worker = new CommunityWorker(db, owned, destination, service, () => now);
    assert.equal((await worker.run()).jobs.pendingContacts, 1);
    const partial = await repo.contact(sample.email);
    assert.equal(partial?.roleJob.status, "done"); assert.equal(partial?.listJob.status, "pending");
    assert.equal(partial?.listJob.attempts, 0); assert.equal(lists, 0);
    assert.equal((await worker.run()).jobs.pendingContacts, 0);
    assert.equal(grants, 1); assert.equal(lists, 1);
  });
  test("fatal worker failures release the lease and record only a generic error", async () => {
    const owned = prefix(); const worker = new CommunityWorker(db, owned, destination,
      { async processDue() { throw new Error("private@example.test secret-details"); } });
    await assert.rejects(worker.run());
    const status = await worker.status(); assert.equal(status.running, false); assert.ok(status.lastFailedAt);
    assert.equal(status.lastError, "Recovery processing failed."); assert.ok(!JSON.stringify(status).includes("private@example"));
    await new CommunityWorker(db, owned, destination, { async processDue() { return 0; } }).run();
    assert.equal((await worker.status()).lastError, null);
  });
  test("recovery selects only the configured guild/role/segment and skips attention jobs", async () => {
    const owned = prefix(); const repo = new MongoCommunityRepository(db, owned); const now = new Date();
    const sample: Contact = { _id: "owned", email: "owned@example.test", createdAt: now, verifiedAt: now,
      enrollmentVersion: 1, enrollmentAcceptedAt: now, ...destination, discordId: "1556786037307613303",
      state: "active", lastVerificationFlowId: "mock-flow", generation: 1, roleJob: freshJob(now), listJob: freshJob(now) };
    await db.collection<Contact>(`${owned}Contacts`).insertMany([sample,
      { ...sample, _id: "wrong-target", email: "other@example.test", guildId: "907092260632535040" },
      { ...sample, _id: "attention", email: "attention@example.test", roleJob: { ...freshJob(now), status: "attention" }, listJob: { ...freshJob(now), status: "done" } }]);
    assert.deepEqual((await repo.due(now, 3, destination)).map(contact => contact._id), ["owned"]);
    const summary = await new CommunityWorker(db, owned, destination, { async processDue() { return 0; } }).status();
    assert.equal(summary.jobs.pendingContacts, 1); assert.equal(summary.jobs.attentionContacts, 1);
  });
});
