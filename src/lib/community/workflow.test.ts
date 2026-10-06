import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import dotenv from "dotenv";
import { MongoClient, type Db } from "mongodb";
import { CODE_MS, MANAGEMENT_MS, type AccountIdentity, type Providers } from "./model";
import { MongoCommunityRepository } from "./mongo-repository";
import { CommunityService, ProviderError } from "./service";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const enabled = process.env.COMMUNITY_MONGO_TEST === "1";

describe("Community workflow against isolated MongoDB collections", { skip: !enabled }, () => {
  let client: MongoClient; let db: Db; let repo: MongoCommunityRepository;
  const prefix = `communitySpec${randomUUID().replaceAll("-", "")}`;
  const destination = { guildId: "1556786037307613317", roleId: "1556786037307613302", segmentId: "test-segment" };
  const secret = "test-key-that-never-goes-to-a-provider";
  let index = 0;
  before(async () => {
    if (process.env.MONGODB_DB !== "blueprint_dev" || !process.env.MONGODB_URI) throw new Error("Mongo integration tests require the blueprint_dev database.");
    client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    await client.connect(); db = client.db("blueprint_dev"); repo = new MongoCommunityRepository(db, prefix);
  });
  after(async () => {
    // Drop only random collections owned by this run, never an application collection/database.
    if (db) for (const suffix of ["VerificationFlows", "Contacts", "Limits", "TrustedMembers"]) {
      await db.collection(`${prefix}${suffix}`).drop().catch((error) => { if (error.codeName !== "NamespaceNotFound") throw error; });
    }
    if (client) await client.close();
  });

  function fixture() {
    index += 1;
    let now = new Date(); let code = "";
    const email = `community-spec-${prefix}-${index}@example.test`.toLowerCase();
    const identity = { id: (BigInt("1556786037307600000") + BigInt(index)).toString(), name: `Test ${index}` };
    const calls = { emails: 0, grants: 0, removes: 0, lists: 0 };
    const providers: Providers = {
      async identity() { return identity; }, async member() { return { pending: false }; },
      async role(_guild, _discord, _role, action) { calls[action === "grant" ? "grants" : "removes"] += 1; },
      async email(_email, value) { calls.emails += 1; code = value; },
      async subscribe() { calls.lists += 1; return { id: `resend-${index}`, unsubscribed: false }; },
    };
    const service = new CommunityService(repo, providers, secret, destination, undefined, () => now);
    const ip = `test-${index}`;
    return { service, providers, calls, email, identity, ip, get code() { return code; }, get now() { return now; },
      advance(ms: number) { now = new Date(now.getTime() + ms); },
      async connected() { const flow = await service.start(ip); await service.callback(flow.token, flow.state, "test-authorization"); return flow; },
      async sent() { const flow = await this.connected(); await service.send(flow.token, email, ip, true); return flow; },
      async verified() { const flow = await this.sent(); await service.confirm(flow.token, code, ip); return flow; },
    };
  }
  const wrong = (code: string) => `${code.slice(0, 5)}${(Number(code[5]) + 1) % 10}`;

  test("correct proof creates a contact and durable jobs, never a Mentor account; repeat processing is idempotent", async () => {
    const f = fixture(); const flow = await f.verified();
    const contact = await repo.contact(f.email); assert.ok(contact);
    assert.equal(contact.discordId, f.identity.id); assert.equal(contact.claimedUserId, undefined);
    assert.equal(await db.collection("user").countDocuments({ email: f.email }), 0);
    assert.deepEqual(f.calls, { emails: 1, grants: 0, removes: 0, lists: 0 });
    assert.equal((await f.service.retry(flow.token)).contact?.role, "done");
    await f.service.status(flow.token); await f.service.retry(flow.token);
    assert.deepEqual(f.calls, { emails: 1, grants: 1, removes: 0, lists: 1 });
    const savedFlow = await repo.flow(f.service.flowId(flow.token), f.now);
    assert.equal(savedFlow?.codeHash, undefined); assert.equal(savedFlow?.oauthHash, undefined);
  });
  test("wrong guesses stay cumulative across resends and lock the flow", async () => {
    const f = fixture(); const flow = await f.sent();
    await assert.rejects(f.service.confirm(flow.token, wrong(f.code), f.ip));
    f.advance(60_000); await f.service.send(flow.token, f.email, f.ip, true);
    await assert.rejects(f.service.confirm(flow.token, wrong(f.code), f.ip));
    await assert.rejects(f.service.confirm(flow.token, wrong(f.code), f.ip));
    await assert.rejects(f.service.confirm(flow.token, f.code, f.ip));
    f.advance(60_000); await assert.rejects(f.service.send(flow.token, f.email, f.ip, true));
    assert.equal(await repo.contact(f.email), null); assert.equal(f.calls.grants, 0);
  });
  test("expired codes fail and new codes replace old codes", async () => {
    const f = fixture(); const flow = await f.sent(); const old = f.code;
    f.advance(CODE_MS); await assert.rejects(f.service.confirm(flow.token, old, f.ip));
    await f.service.send(flow.token, f.email, f.ip, true);
    await f.service.confirm(flow.token, f.code, f.ip);
  });
  test("parallel wrong guesses reserve at most three attempts", async () => {
    const f = fixture(); const flow = await f.sent();
    const results = await Promise.allSettled(Array.from({ length: 7 }, () => f.service.confirm(flow.token, wrong(f.code), f.ip)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 0);
    assert.equal((await repo.flow(f.service.flowId(flow.token), f.now))?.attempts, 3);
    await assert.rejects(f.service.confirm(flow.token, f.code, f.ip));
    assert.equal(await repo.contact(f.email), null);
  });
  test("codes are consumed atomically under concurrent confirmations and replay", async () => {
    const f = fixture(); const flow = await f.sent();
    const results = await Promise.allSettled([f.service.confirm(flow.token, f.code, f.ip), f.service.confirm(flow.token, f.code, f.ip)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await db.collection(`${prefix}Contacts`).countDocuments({ email: f.email }), 1);
    await assert.rejects(f.service.confirm(flow.token, f.code, f.ip));
  });
  test("concurrent sends reserve one delivery and enforce cooldown", async () => {
    const f = fixture(); const flow = await f.connected();
    const results = await Promise.allSettled([f.service.send(flow.token, f.email, f.ip, true), f.service.send(flow.token, f.email, f.ip, true)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1); assert.equal(f.calls.emails, 1);
    await assert.rejects(f.service.send(flow.token, f.email, f.ip, true), /60 seconds/);
  });
  test("failed sending never marks a code sent or enrolls a contact", async () => {
    const f = fixture(); const flow = await f.connected();
    f.providers.email = async () => { throw new Error("provider-rejected"); };
    await assert.rejects(f.service.send(flow.token, f.email, f.ip, true), /could not be sent/);
    assert.equal((await f.service.status(flow.token)).stage, "email");
    assert.equal(await repo.contact(f.email), null);
    assert.equal((await repo.flow(f.service.flowId(flow.token), f.now))?.codeHash, undefined);
  });
  test("OAuth state and browser flow bind identities and cannot be reused", async () => {
    const f = fixture(); const flow = await f.service.start(f.ip);
    await assert.rejects(f.service.callback(flow.token, "wrong-state", "test-authorization"));
    await f.service.callback(flow.token, flow.state, "test-authorization");
    await assert.rejects(f.service.callback(flow.token, flow.state, "test-authorization"));
    const other = await f.connected(); await f.service.send(flow.token, f.email, f.ip, true);
    await assert.rejects(f.service.confirm(other.token, f.code, f.ip));
    await assert.rejects(f.service.send(other.token, f.email, f.ip, false));
  });
  test("flow expiry is enforced without waiting for TTL deletion", async () => {
    const f = fixture(); const flow = await f.sent(); f.advance(30 * 60_000);
    await assert.rejects(f.service.confirm(flow.token, f.code, f.ip), /expired/);
  });
  test("test-recipient restriction blocks email delivery", async () => {
    const f = fixture(); const limited = new CommunityService(repo, f.providers, secret, destination, ["allowed@example.test"], () => f.now);
    const flow = await limited.start(f.ip); await limited.callback(flow.token, flow.state, "test");
    await assert.rejects(limited.send(flow.token, f.email, f.ip, true), /test inboxes/);
    assert.equal(f.calls.emails, 0);
  });
  test("non-members cannot proceed and screening delays role activation while list sync succeeds", async () => {
    const denied = fixture(); denied.providers.member = async () => { throw new ProviderError("Join the server", true); };
    const flow = await denied.service.start(denied.ip);
    await assert.rejects(denied.service.callback(flow.token, flow.state, "test"), /Join/);
    const f = fixture(); f.providers.member = async () => ({ pending: true });
    const pending = await f.verified(); let status = await f.service.retry(pending.token);
    assert.equal(status.contact?.role, "pending"); assert.equal(status.contact?.mailing, "done"); assert.equal(f.calls.grants, 0);
    f.providers.member = async () => ({ pending: false }); f.advance(60_000);
    status = await f.service.retry(pending.token); assert.equal(status.contact?.role, "done");
  });
  test("Discord retry timing and independent mailing failure persist without requiring new proof", async () => {
    const f = fixture(); const flow = await f.verified();
    const grant = f.providers.role;
    f.providers.role = async () => { throw new ProviderError("Discord busy", true, 120); };
    f.providers.subscribe = async () => { throw new ProviderError("Contacts key needs attention", false); };
    let status = await f.service.retry(flow.token);
    assert.equal(status.contact?.role, "pending"); assert.equal(status.contact?.mailing, "attention");
    f.providers.role = grant; f.advance(60_000); await f.service.retry(flow.token); assert.equal(f.calls.grants, 0);
    f.advance(60_000); status = await f.service.retry(flow.token); assert.equal(status.contact?.role, "done");
    f.providers.subscribe = async () => ({ id: "existing", unsubscribed: true });
    status = await f.service.retry(flow.token); assert.equal(status.contact?.mailing, "done");
    assert.equal((await repo.contact(f.email))?.unsubscribed, true);
  });
  test("unique email and Discord indexes prevent conflicting connections", async () => {
    const f = fixture(); await f.verified();
    const other = fixture(); const flow = await other.connected();
    await other.service.send(flow.token, f.email, other.ip, true);
    await assert.rejects(other.service.confirm(flow.token, other.code, other.ip), /existing connection/);
    const duplicate = fixture(); duplicate.providers.identity = async () => f.identity;
    const duplicateFlow = await duplicate.sent();
    await assert.rejects(duplicate.service.confirm(duplicateFlow.token, duplicate.code, duplicate.ip), /existing connection/);
    assert.equal(await repo.contact(duplicate.email), null);
  });
  test("exclusive job lease prevents parallel grants and rejects unlink while activation is in flight", async () => {
    const f = fixture(); const flow = await f.verified(); const contact = (await repo.contact(f.email))!;
    const first = await repo.lease(contact._id, f.now); assert.ok(first);
    assert.equal(await repo.lease(contact._id, f.now), null);
    await assert.rejects(repo.revoke(f.email, f.now), /updating/);
    await f.service.retry(flow.token); assert.equal(f.calls.grants, 0);
    await repo.release(contact._id, first.token);
    await Promise.all([f.service.retry(flow.token), f.service.retry(flow.token)]); assert.equal(f.calls.grants, 1);
  });
  test("management proof alone can unlink; an old completed flow never restores access", async () => {
    const f = fixture(); const original = await f.verified(); await f.service.retry(original.token);
    await assert.rejects(f.service.disconnect(original.token), /management code/);
    const manage = await f.service.start(f.ip, "manage"); await f.service.send(manage.token, f.email, f.ip, false);
    await f.service.confirm(manage.token, f.code, f.ip); f.advance(1);
    const status = await f.service.disconnect(manage.token);
    assert.equal(status.contact?.state, "unlinked"); assert.equal(f.calls.removes, 1);
    await f.service.status(original.token); await f.service.retry(original.token);
    assert.equal((await repo.contact(f.email))?.state, "unlinked"); assert.equal(f.calls.grants, 1);
  });
  test("replacement waits for old access removal, then preserves unsubscribe/list history", async () => {
    const f = fixture(); const original = await f.verified(); await f.service.retry(original.token);
    const manage = await f.service.start(f.ip, "manage"); await f.service.send(manage.token, f.email, f.ip, false);
    await f.service.confirm(manage.token, f.code, f.ip); f.advance(1);
    const role = f.providers.role; f.providers.role = async () => { throw new ProviderError("Removal delayed", true); };
    assert.equal((await f.service.disconnect(manage.token)).contact?.state, "revoking");
    f.advance(60_000); f.providers.role = role; await f.service.retry(manage.token);
    const replacement = fixture(); replacement.advance(120_000);
    const fresh = await replacement.connected(); await replacement.service.send(fresh.token, f.email, replacement.ip, true);
    await replacement.service.confirm(fresh.token, replacement.code, replacement.ip); await replacement.service.retry(fresh.token);
    const contact = (await repo.contact(f.email))!;
    assert.equal(contact.discordId, replacement.identity.id); assert.equal(contact.listJob.status, "done");
    assert.equal(replacement.calls.lists, 0); assert.deepEqual(contact.revokedDiscordIds, [f.identity.id]);
  });
  test("expired management proof cannot unlink", async () => {
    const f = fixture(); await f.verified(); const manage = await f.service.start(f.ip, "manage");
    await f.service.send(manage.token, f.email, f.ip, false); await f.service.confirm(manage.token, f.code, f.ip);
    f.advance(MANAGEMENT_MS); await assert.rejects(f.service.disconnect(manage.token), /fresh management/);
    assert.equal((await repo.contact(f.email))?.state, "active");
  });
  const account = (email: string): AccountIdentity => ({ id: randomUUID(), email, emailVerified: true });
  test("signed-in account unlink needs no management code and cannot manage another account's contact", async () => {
    const f = fixture(); const original = await f.verified(); await f.service.retry(original.token);
    const owner = account(f.email); await f.service.profile(owner);
    await assert.rejects(f.service.disconnectAccount(null), /Sign in/);
    await assert.rejects(f.service.disconnectAccount({ ...owner, emailVerified: false }), /Sign in/);
    await assert.rejects(f.service.disconnectAccount(account(f.email)), /existing connection/);
    await f.service.disconnectAccount(account("other@example.test"));
    assert.equal((await repo.contact(f.email))?.state, "active");
    const callsBefore = { ...f.calls }; f.advance(1);
    assert.equal((await f.service.disconnectAccount(owner)).contact?.state, "unlinked");
    assert.equal(f.calls.emails, callsBefore.emails); assert.equal(f.calls.removes, 1);
    await f.service.disconnectAccount(owner); assert.equal(f.calls.removes, 1);
    await f.service.retry(original.token); assert.equal((await repo.contact(f.email))?.state, "unlinked");
  });
  test("trusted member needs no email/contact and optional linking/unlinking preserves Verified", async () => {
    const f = fixture(); await repo.recordTrustedMember(destination.guildId, f.identity.id, f.now);
    await repo.recordTrustedMember(destination.guildId, f.identity.id, f.now);
    assert.equal(await db.collection(`${prefix}TrustedMembers`).countDocuments({ discordId: f.identity.id }), 1);
    assert.equal(await repo.contact(f.email), null); assert.equal(f.calls.emails, 0);
    assert.equal(await repo.trustedMember("1556786037307613999", f.identity.id), false);
    const original = await f.verified(); await f.service.retry(original.token);
    const owner = account(f.email); assert.equal((await f.service.profile(owner)).contact?.trustedMember, true);
    f.advance(1); const unlinked = await f.service.disconnectAccount(owner);
    assert.equal(unlinked.contact?.state, "unlinked"); assert.equal(unlinked.contact?.trustedMember, true);
    assert.equal(f.calls.removes, 0); assert.equal(f.calls.emails, 1);
    await f.service.retry(original.token); assert.equal(f.calls.grants, 1);
    // Moving the website link cannot transfer the old Discord's trusted status to a new Discord.
    const replacement = fixture(); replacement.advance(120_000);
    const fresh = await replacement.connected(); await replacement.service.send(fresh.token, f.email, replacement.ip, true);
    await replacement.service.confirm(fresh.token, replacement.code, replacement.ip); await replacement.service.retry(fresh.token);
    assert.equal((await replacement.service.profile(owner)).contact?.trustedMember, false);
    replacement.advance(1); await replacement.service.disconnectAccount(owner);
    assert.equal(replacement.calls.removes, 1); assert.equal(await repo.trustedMember(destination.guildId, f.identity.id), true);
  });
  test("anonymous management also preserves trusted access; a failed trust lookup never removes it", async () => {
    const f = fixture(); const original = await f.verified(); await f.service.retry(original.token);
    await repo.recordTrustedMember(destination.guildId, f.identity.id, f.now);
    const manage = await f.service.start(f.ip, "manage"); await f.service.send(manage.token, f.email, f.ip, false);
    await f.service.confirm(manage.token, f.code, f.ip); f.advance(1);
    const lookup = repo.trustedMember.bind(repo);
    repo.trustedMember = async () => { throw new Error("storage unavailable"); };
    try { await assert.rejects(f.service.disconnect(manage.token)); }
    finally { repo.trustedMember = lookup; }
    assert.equal(f.calls.removes, 0); assert.equal((await repo.contact(f.email))?.state, "revoking");
    f.advance(60_000); const status = await f.service.retry(manage.token);
    assert.equal(status.contact?.state, "unlinked"); assert.equal(status.contact?.trustedMember, true); assert.equal(f.calls.removes, 0);
  });
  test("later verified account claim is unique and preserves original contact through email changes", async () => {
    const f = fixture(); await f.verified(); const userId = randomUUID();
    assert.equal((await repo.claim(f.email, userId))?.claimedUserId, userId);
    await assert.rejects(repo.claim(f.email, randomUUID()), /existing connection/);
    assert.equal((await repo.claim("new-address@example.test", userId))?.email, f.email);
    assert.equal(await repo.claim("no-contact@example.test", randomUUID()), null);
  });
  test("worker recovers a consumed code whose contact write was interrupted", async () => {
    const f = fixture(); const flow = await f.sent();
    const originalEnroll = repo.enroll.bind(repo); let failed = false;
    repo.enroll = async (...args) => { if (!failed) { failed = true; throw new Error("interrupted"); } return originalEnroll(...args); };
    try { await assert.rejects(f.service.confirm(flow.token, f.code, f.ip), /interrupted/); }
    finally { repo.enroll = originalEnroll; }
    assert.equal(await repo.contact(f.email), null);
    for (let tries = 0; tries < 10 && (await repo.contact(f.email))?.roleJob.status !== "done"; tries++) await f.service.processDue();
    assert.equal((await repo.contact(f.email))?.roleJob.status, "done");
  });
  test("fixed-window database limiter stays within budget under concurrent requests", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => repo.limit(`concurrent-${prefix}`, 5, 3600, new Date())));
    assert.equal(results.filter(Boolean).length, 5);
  });
});
