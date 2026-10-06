import assert from "node:assert/strict";
import { test } from "node:test";
import { communityConfig } from "./config";
import { liveProviders, providerFailure } from "./providers";
import { checkOrigin, codeDigest, normalizeEmail } from "./security";
import type { Flow } from "./model";

const env = {
  COMMUNITY_VERIFICATION_ENABLED: "true", COMMUNITY_ENV: "test", COMMUNITY_VERIFICATION_SECRET: "s".repeat(40),
  COMMUNITY_TEST_RECIPIENTS: "controlled@example.com", DISCORD_CLIENT_ID: "1556786037307613301", DISCORD_CLIENT_SECRET: "dummy-secret",
  DISCORD_BOT_TOKEN: "dummy-bot-token", DISCORD_GUILD_ID: "1556786037307613317", DISCORD_VERIFIED_ROLE_ID: "1556786037307613302",
  DISCORD_REDIRECT_URI: "http://localhost:3000/api/discord/connect/callback", DISCORD_INVITE_URL: "https://discord.gg/test",
  RESEND_CONTACTS_API_KEY: "dummy-contacts-key", RESEND_API_KEY: "dummy-sending-key", RESEND_COMMUNITY_SEGMENT_ID: "test-segment", EMAIL_FROM: "Test <test@example.com>",
};
const config = communityConfig(env);
const reply = (data: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(data), { status, headers });
type Call = { url: string; init?: RequestInit };
function adapter(responses: Response[]) {
  const calls: Call[] = [];
  const fake: typeof fetch = async (url, init) => { calls.push({ url: String(url), init }); assert.ok(init?.signal); return responses.shift()!; };
  return { calls, providers: liveProviders(config, fake) };
}

test("feature and environment guards fail closed", () => {
  assert.throws(() => communityConfig({}), /not available/);
  assert.throws(() => communityConfig({ ...env, VERCEL_ENV: "preview", COMMUNITY_ENV: "production" }), /Preview/);
  assert.throws(() => communityConfig({ ...env, COMMUNITY_PRODUCTION_GUILD_ID: env.DISCORD_GUILD_ID }), /production guild/);
  assert.throws(() => communityConfig({ ...env, COMMUNITY_TEST_RECIPIENTS: "" }), /configured/);
  assert.throws(() => communityConfig({ ...env, NODE_ENV: "production" }), /secure Mentor/);
});
test("email normalization preserves aliases and code hashes bind purpose, flow and identity", () => {
  assert.equal(normalizeEmail(" Name+tag@Example.com "), "name+tag@example.com");
  assert.throws(() => normalizeEmail("not-an-email"));
  const flow: Flow = { _id: "flow", purpose: "connect", state: "sent", expiresAt: new Date(), attempts: 0, discord: { id: "1", name: "Test" } };
  const original = codeDigest("secret", flow, "a@example.com", "123456");
  for (const changed of [{ ...flow, _id: "other" }, { ...flow, purpose: "manage" as const }, { ...flow, discord: { id: "2", name: "Test" } }]) {
    assert.notEqual(codeDigest("secret", changed, "a@example.com", "123456"), original);
  }
  assert.throws(() => checkOrigin("https://evil.test", "http://localhost:3000"));
  assert.throws(() => checkOrigin(null, "http://localhost:3000"));
});
test("OAuth uses identify, exchange in body, and discarded bearer token", async () => {
  const { calls, providers } = adapter([reply({ access_token: "temporary" }), reply({ id: "1556786037307613303", username: "tester", global_name: "Test User" })]);
  assert.deepEqual(await providers.identity("authorization"), { id: "1556786037307613303", name: "Test User" });
  assert.equal(calls[0].init?.method, "POST");
  const form = calls[0].init?.body as URLSearchParams;
  assert.equal(form.get("redirect_uri"), config.redirectUri);
  assert.equal(form.get("client_secret"), config.clientSecret);
  assert.equal(new Headers(calls[1].init?.headers).get("authorization"), "Bearer temporary");
});
test("rules screening and missing-member responses are explicit", async () => {
  const { providers } = adapter([reply({ pending: true }), reply({}, 404)]);
  assert.deepEqual(await providers.member(config.guildId, "1"), { pending: true });
  await assert.rejects(providers.member(config.guildId, "1"), /Join the configured community/);
});
test("role removal tolerates departed members but grant never treats 404 as success", async () => {
  const { calls, providers } = adapter([reply({}, 404), reply({}, 404)]);
  await providers.role(config.guildId, "1", config.roleId, "remove");
  await assert.rejects(providers.role(config.guildId, "1", config.roleId, "grant"));
  assert.equal(calls[0].init?.method, "DELETE"); assert.equal(calls[1].init?.method, "PUT");
});
test("existing unsubscribe preference is never overwritten", async () => {
  const { calls, providers } = adapter([reply({ id: "contact", unsubscribed: true }), reply({ id: "segment" })]);
  assert.deepEqual(await providers.subscribe("a@example.com", "segment"), { id: "contact", unsubscribed: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "https://api.resend.com/contacts/contact/segments/segment");
  assert.equal(calls[1].init?.body, undefined);
});
test("new contact creation omits unsubscribe mutation and adds segment", async () => {
  const { calls, providers } = adapter([reply({}, 404), reply({ id: "new" }), reply({ id: "new", unsubscribed: false }), reply({ id: "segment" })]);
  await providers.subscribe("a@example.com", "segment");
  assert.deepEqual(JSON.parse(calls[1].init?.body as string), { email: "a@example.com", segments: [{ id: "segment" }] });
});
test("contact creation race recovers by reading, preserving another integration's unsubscribe", async () => {
  const { providers } = adapter([reply({}, 404), reply({}, 409), reply({ id: "existing", unsubscribed: true }), reply({ id: "segment" })]);
  assert.equal((await providers.subscribe("a@example.com", "segment")).unsubscribed, true);
});
test("permission failures remain visible and rate limits retain provider delay", async () => {
  assert.equal(providerFailure(reply({}, 403), "Resend").retryable, false);
  assert.equal(providerFailure(reply({}, 429, { "retry-after": "120" }), "Discord").retryAfter, 120);
  const { providers } = adapter([reply({}, 401)]);
  await assert.rejects(providers.subscribe("a@example.com", "segment"), /permissions/);
});
test("email errors are thrown, using existing sending key and explicit sender", async () => {
  const { providers, calls } = adapter([reply({}, 429)]);
  await assert.rejects(providers.email("a@example.com", "123456", "connect"));
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), `Bearer ${config.emailKey}`);
  assert.equal(JSON.parse(calls[0].init?.body as string).from, config.sender);
});

test("Discord email payloads use branded HTML, escaped names and plain text without contact mutations", async () => {
  const { providers, calls } = adapter([reply({ id: "sent" }), reply({ id: "sent" })]);
  const name = 'Tom <img src=x onerror="alert(1)">';
  await providers.email("a@example.com", "123456", "connect", name);
  await providers.email("a@example.com", "654321", "manage");
  assert.equal(calls.length, 2);
  for (const call of calls) assert.equal(call.url, "https://api.resend.com/emails");
  const connect = JSON.parse(calls[0].init?.body as string);
  const manage = JSON.parse(calls[1].init?.body as string);
  assert.equal(connect.to, "a@example.com");
  assert.equal(connect.from, config.sender);
  assert.ok(connect.html.includes("123456"));
  assert.ok(connect.html.includes("#ff6719"));
  assert.ok(!connect.html.includes("<img"));
  assert.ok(connect.html.includes("Tom &lt;img"));
  assert.ok(connect.text.includes(name));
  assert.ok(!connect.html.includes("Verifying joins"));
  assert.ok(!connect.text.includes("community email list"));
  assert.ok(connect.html.includes(`${config.origin}/discord/verify`));
  assert.equal((connect.html.match(/Expires in /g) || []).length, 1);
  assert.ok(manage.text.includes("654321"));
  assert.ok(manage.text.includes("unlinking"));
  assert.ok(manage.html.includes(`${config.origin}/discord/manage`));
  assert.ok(!manage.html.includes("No Mentor account required"));
});

test("recovery requires a dedicated secret and matching environment plus guild", async () => {
  const { authorizeProcessor, checkProcessorTarget } = await import("./processor-security");
  const secret = "discord-recovery-secret-".repeat(2);
  const headers = new Headers({ authorization: `Bearer ${secret}`, "x-community-environment": "test", "x-community-guild": config.guildId });
  authorizeProcessor(headers, secret); checkProcessorTarget(headers, config);
  assert.throws(() => authorizeProcessor(headers, undefined), /Unauthorized/);
  assert.throws(() => authorizeProcessor(headers, "short"), /Unauthorized/);
  assert.throws(() => authorizeProcessor(new Headers({ authorization: "Bearer journal-cron-secret" }), secret), /Unauthorized/);
  assert.throws(() => checkProcessorTarget(new Headers({ "x-community-environment": "production", "x-community-guild": config.guildId }), config), /target/);
  assert.throws(() => checkProcessorTarget(new Headers({ "x-community-environment": "test", "x-community-guild": "907092260632535040" }), config), /target/);
  assert.throws(() => checkProcessorTarget(new Headers(), config), /target/);
});
