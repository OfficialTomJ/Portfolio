import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { after, before, describe, test } from "node:test";
import dotenv from "dotenv";
import { MongoClient, type Db } from "mongodb";
import { communityConfig } from "./config";
import { parseButtonInteraction, privateDeferred, privateReply, START_BUTTON, STATUS_BUTTON, validDiscordSignature } from "./interaction-security";
import { DiscordOnboarding, openInteractionToken, privateComponents, sealInteractionToken, starterMessage, verificationMessage } from "./onboarding";
import { freshJob, CommunityService } from "./service";
import { MongoCommunityRepository } from "./mongo-repository";
import type { Providers } from "./model";

dotenv.config({ path: ".env.local", quiet: true });
const app = "1556793022421667880", guild = "1556786037307613317", channel = "1556796471767081020";
const user = "674118301022027776", role = "1556795365913526338";
const interaction = (id = "1556796471767081000") => ({ type: 3 as const, id, application_id: app, guild_id: guild,
  channel_id: channel, token: "private-interaction-token", member: { user: { id: user } },
  message: { author: { id: app } }, data: { component_type: 2 as const, custom_id: START_BUTTON as typeof START_BUTTON } });

test("Discord signature verification rejects raw-body changes, missing headers and stale requests", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicHex = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
  const now = Date.now(), timestamp = String(Math.floor(now / 1000)), body = JSON.stringify(interaction());
  const headers = new Headers({ "x-signature-timestamp": timestamp,
    "x-signature-ed25519": sign(null, Buffer.from(timestamp + body), privateKey).toString("hex") });
  assert.equal(validDiscordSignature(body, headers, publicHex, now), true);
  assert.equal(validDiscordSignature(body + " ", headers, publicHex, now), false);
  assert.equal(validDiscordSignature(body, headers, publicHex, now + 301_000), false);
  assert.equal(validDiscordSignature(body, headers, publicHex, now - 61_000), false);
  assert.equal(validDiscordSignature(body, new Headers(), publicHex, now), false);
});
test("buttons are restricted to the configured application, server, channel and bot author", () => {
  const config = { clientId: app, guildId: guild, channelId: channel }, i = interaction();
  assert.ok(parseButtonInteraction(i, config));
  for (const key of ["application_id", "guild_id", "channel_id"] as const) assert.equal(parseButtonInteraction({ ...i, [key]: "907092260632535040" }, config), null);
  assert.equal(parseButtonInteraction({ ...i, message: { author: { id: user } } }, config), null);
  assert.equal(parseButtonInteraction({ ...i, data: { component_type: 2, custom_id: "unknown" } }, config), null);
  assert.equal(parseButtonInteraction({ ...i, member: undefined }, config), null);
});
test("all button acknowledgements are private and the permanent message suppresses mentions", () => {
  assert.equal(privateDeferred.type, 5); assert.equal(privateDeferred.data.flags, 64);
  assert.equal(privateReply("hello").data.flags, 64);
  assert.deepEqual(starterMessage.allowed_mentions, { parse: [] });
  assert.ok(!starterMessage.content.includes("@everyone"));
});
test("status only claims success for actual access; pending role, screening and blocked states are explicit", () => {
  const pending = { state: "active" as const, roleJob: freshJob(new Date()) };
  assert.match(verificationMessage({ roles: [] }, null, role).content, /Waiting/);
  assert.match(verificationMessage({ roles: [] }, pending, role).content, /Activating/);
  assert.match(verificationMessage({ roles: [] }, { ...pending, roleJob: { ...pending.roleJob, attempts: 1 } }, role).content, /delayed/);
  assert.match(verificationMessage({ roles: [] }, { ...pending, roleJob: { ...pending.roleJob, status: "done" } }, role).content, /Waiting/);
  assert.match(verificationMessage({ roles: [role] }, null, role).content, /complete/);
  assert.match(verificationMessage({ roles: [role], pending: true }, null, role).content, /rules/);
  assert.match(verificationMessage({ roles: [role] }, { ...pending, state: "blocked" }, role).content, /restricted/);
});
test("stored interaction tokens are encrypted and authenticated", () => {
  const encrypted = sealInteractionToken("private-token", "test-secret");
  assert.ok(!encrypted.includes("private-token"));
  assert.equal(openInteractionToken(encrypted, "test-secret"), "private-token");
  assert.throws(() => openInteractionToken(encrypted, "different-secret"));
});
test("successful replies have no verification or email-link button", () => {
  const success = privateComponents(true, "https://example.test/verify");
  assert.deepEqual(success[0].components.map(button => button.label), ["Check status"]);
  assert.ok(success[0].components.every(button => !("url" in button)));
  assert.deepEqual(privateComponents(false, "https://example.test/verify")[0].components.map(button => button.label), ["Verify email", "Check status"]);
});

describe("Discord private onboarding against isolated MongoDB collections", { skip: process.env.COMMUNITY_MONGO_TEST !== "1" }, () => {
  let client: MongoClient; let db: Db;
  const prefix = `communityOnboardingSpec${randomUUID().replaceAll("-", "")}`;
  before(async () => {
    if (process.env.MONGODB_DB !== "blueprint_dev" || !process.env.MONGODB_URI) throw new Error("Requires development database");
    client = new MongoClient(process.env.MONGODB_URI); await client.connect(); db = client.db("blueprint_dev");
  });
  after(async () => {
    if (db) for (const suffix of ["DiscordEntries", "DiscordReplies", "VerificationFlows", "Contacts", "Limits", "TrustedMembers"]) {
      await db.collection(`${prefix}${suffix}`).drop().catch(error => { if (error.codeName !== "NamespaceNotFound") throw error; });
    }
    await client?.close();
  });
  test("private entry binds OAuth identity; replay, expiry and public disclosure are prevented", async () => {
    let now = new Date(), roles: string[] = [], failEdit = false; const edits: { path: string; body: Record<string, unknown> }[] = [];
    const config = communityConfig(); const repo = new MongoCommunityRepository(db, prefix);
    const fetcher: typeof fetch = async (input, init) => {
      const path = String(input);
      if (path.includes("/members/")) return Response.json({ roles });
      edits.push({ path, body: JSON.parse(String(init?.body)) });
      return failEdit ? new Response(null, { status: 500 }) : Response.json({ id: "private-reply" });
    };
    const onboarding = new DiscordOnboarding(db, prefix, config, fetcher, () => now);
    await onboarding.handle(interaction(), repo.limit.bind(repo));
    assert.equal(edits.length, 1); assert.match(edits[0].path, /\/webhooks\/.*\/messages\/@original$/);
    assert.deepEqual(edits[0].body.allowed_mentions, { parse: [] });
    assert.ok(!JSON.stringify(edits[0].body).includes("@gmail.com"));
    const rows = edits[0].body.components as { components: { url?: string }[] }[];
    const ticket = new URL(rows[0].components[0].url!).searchParams.get("ticket")!;
    assert.equal(await onboarding.entry(ticket), user);
    await assert.rejects(onboarding.entry("x".repeat(43)));
    const saved = await db.collection(`${prefix}DiscordReplies`).findOne({ discordId: user });
    assert.ok(saved); assert.notEqual(saved.encryptedToken, interaction().token);
    await onboarding.handle(interaction(), repo.limit.bind(repo)); assert.equal(edits.length, 1);
    const providers: Providers = { async identity() { return { id: "674118301022027777", name: "Other" }; },
      async member() { return { pending: false }; }, async role() { throw new Error("No role should change"); },
      async email() { throw new Error("No email should send"); }, async subscribe() { throw new Error("No contact should subscribe"); } };
    const service = new CommunityService(repo, providers, config.secret, { guildId: guild, roleId: role, segmentId: config.segmentId }, undefined, () => now);
    const flow = await service.start("onboarding-test", "connect", await onboarding.entry(ticket));
    await assert.rejects(service.callback(flow.token, flow.state, "mock-code"), /account that clicked/);
    assert.equal((await repo.flow(service.flowId(flow.token), now))?.discord, undefined);
    roles = [role]; failEdit = true; now = new Date(now.getTime() + 31_000);
    await onboarding.processDue();
    assert.match(edits.at(-1)!.body.content as string, /Verification complete/);
    const failed = await db.collection(`${prefix}DiscordReplies`).findOne({ discordId: user });
    assert.match(failed!.lastContent, /Waiting/);
    failEdit = false; now = new Date(now.getTime() + 31_000); await onboarding.processDue();
    assert.match((await db.collection(`${prefix}DiscordReplies`).findOne({ discordId: user }))!.lastContent, /Verification complete/);
    assert.deepEqual((edits.at(-1)!.body.components as { components: { label: string }[] }[])[0].components.map(button => button.label), ["Check status"]);
    const beforeExpiry = edits.length; now = new Date(now.getTime() + 31 * 60_000);
    await onboarding.processDue(); assert.equal(edits.length, beforeExpiry); await assert.rejects(onboarding.entry(ticket));
    // A fresh status click remains usable after the old private reply expires.
    await onboarding.handle({ ...interaction("1556796471767081001"), data: { component_type: 2, custom_id: STATUS_BUTTON } }, repo.limit.bind(repo));
    assert.match(edits.at(-1)!.body.content as string, /Verification complete/);
    assert.deepEqual((edits.at(-1)!.body.components as { components: { label: string }[] }[])[0].components.map(button => button.label), ["Check status"]);
  });
});
