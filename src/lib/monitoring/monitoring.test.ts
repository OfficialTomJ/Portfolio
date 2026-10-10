import test from "node:test";
import assert from "node:assert/strict";
import { imageCoverageHealth, syncHealth } from "./policy";
import { evaluateAndReport, reportHealth } from "./report";

const now = new Date("2026-10-10T02:00:00Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const completed = { environment: "demo", expectedEnvironment: "demo", runStatus: "succeeded", sourceAccountId: "account",
  lastSuccessAt: minutesAgo(5), completedAt: minutesAgo(4) };

test("a completed source check is healthy without requiring new trades", () => {
  assert.equal(syncHealth(completed, now).status, "healthy");
});
test("a stuck running invocation cannot replace completed-success evidence", () => {
  assert.equal(syncHealth({ ...completed, runStatus: "running" }, now).status, "failed");
  assert.equal(syncHealth({ ...completed, lastSuccessAt: minutesAgo(46), completedAt: minutesAgo(45) }, now).reason, "sync_overdue");
});
test("account mismatch, absent run and future or invalid timestamps fail closed", () => {
  assert.equal(syncHealth({ ...completed, expectedAccountId: "other" }, now).status, "failed");
  assert.equal(syncHealth({ ...completed, completedAt: undefined }, now).status, "failed");
  assert.equal(syncHealth({ ...completed, lastSuccessAt: minutesAgo(-10) }, now).status, "failed");
  assert.equal(syncHealth({ ...completed, lastSuccessAt: new Date(NaN) }, now).status, "failed");
});
test("unchanged valid image versions remain healthy without regeneration", () => {
  assert.equal(imageCoverageHealth([{ key: "old", changedAt: minutesAgo(1000) }], new Set(["old"]), 0, now).status, "healthy");
});
test("missing images get a fixed publication grace, then fail independently", () => {
  assert.equal(imageCoverageHealth([{ key: "new", changedAt: minutesAgo(30) }], new Set(), 0, now).status, "waiting");
  assert.equal(imageCoverageHealth([{ key: "new", changedAt: minutesAgo(61) }], new Set(), 0, now).status, "failed");
  assert.equal(imageCoverageHealth([{ key: "unknown" }], new Set(), 0, now).status, "failed");
});
test("corruption is immediately actionable even during publication grace", () => {
  assert.equal(imageCoverageHealth([{ key: "new", changedAt: minutesAgo(1) }], new Set(), 1, now).reason, "image_integrity_failed");
});

const ping = "https://hc-ping.com/11111111-1111-1111-1111-111111111111";
test("signals contain only safe outcomes and failure uses the failure endpoint", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url, init) => { calls.push({ url: String(url), init }); return new Response("OK"); }) as typeof fetch;
  await reportHealth(ping, { status: "healthy", reason: "completed_sync_recent" }, fetcher);
  await reportHealth(ping, { status: "failed", reason: "sync_overdue" }, fetcher);
  assert.deepEqual(calls.map(call => call.url), [ping, `${ping}/fail`]);
  assert.equal(calls[0].init?.redirect, "error");
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { status: "failed", reason: "sync_overdue" });
});
test("the fixed image allowance remains up with an explicit waiting outcome", async () => {
  const calls: { url: string; body: unknown }[] = [];
  await reportHealth(ping, { status: "waiting", reason: "images_within_publication_grace" },
    (async (url, init) => { calls.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return new Response("OK"); }) as typeof fetch);
  assert.equal(calls[0].url, ping);
  assert.deepEqual(calls[0].body, { status: "waiting", reason: "images_within_publication_grace" });
});
test("credentials stay on the exact Healthchecks host and unexpected responses cannot count as a ping", async () => {
  await assert.rejects(reportHealth("https://other.example.com/11111111-1111-1111-1111-111111111111",
    { status: "healthy", reason: "ok" }));
  await assert.rejects(reportHealth("https://user:password@hc-ping.com/11111111-1111-1111-1111-111111111111",
    { status: "healthy", reason: "ok" }));
  let calls = 0;
  await assert.rejects(reportHealth(ping, { status: "healthy", reason: "ok" },
    (async () => { calls++; return new Response("not found"); }) as typeof fetch));
  assert.equal(calls, 3);
});
test("one service throwing does not conceal another result and raw exceptions are sanitized", async () => {
  const bodies: string[] = [];
  const fetcher = (async (_url, init) => { bodies.push(String(init?.body)); return new Response("OK"); }) as typeof fetch;
  const results = await Promise.all([
    evaluateAndReport("broken", async () => { throw new Error("private-token"); }, ping, false, fetcher),
    evaluateAndReport("working", async () => ({ status: "healthy", reason: "valid_images" }), ping, false, fetcher),
  ]);
  assert.deepEqual(results, [false, true]);
  assert.equal(bodies.some(body => body.includes("private-token")), false);
});
test("dry-run reports never contact the notification service", async () => {
  await evaluateAndReport("preview", async () => ({ status: "healthy", reason: "ok" }), undefined, true,
    (async () => { throw new Error("should not send"); }) as typeof fetch);
});
