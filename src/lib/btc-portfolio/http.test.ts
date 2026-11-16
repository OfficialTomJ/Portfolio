import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { newEvent } from "./engine";
import type { AdminSnapshot } from "./schema";

test("localhost persistence, privacy, atomicity, replay, publication, restore and retry protection", { skip: process.env.BTC_HTTP_TEST !== "1" }, async t => {
  const origin = "http://mentor.localhost:3000", base = "http://127.0.0.1:3000";
  const headers = { host: "mentor.localhost:3000", origin, "Content-Type": "application/json" };
  const localFetch = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) => new Promise<{ status: number; text: () => Promise<string>; json: () => Promise<AdminSnapshot & Record<string, unknown>> }>((resolve, reject) => {
    const req = request(url, { method: init.method, headers: init.headers }, response => {
      let body = ""; response.setEncoding("utf8"); response.on("data", chunk => body += chunk); response.on("end", () => resolve({ status: response.statusCode!, text: async () => body, json: async () => JSON.parse(body) }));
    }); req.on("error", reject); req.end(init.body);
  });
  const admin = async () => { const r = await localFetch(`${base}/api/btc-portfolio/admin`, { headers }); assert.equal(r.status, 200); return await r.json() as AdminSnapshot; };
  const publicRead = async () => { const r = await localFetch(`${base}/api/btc-portfolio`, { headers }); assert.equal(r.status, 200); return await r.json(); };
  let state = await admin(); assert.equal(state.draft.mode, "mock");
  const initial = state, originalPublic = await publicRead();
  if (originalPublic.mode !== "mock") { t.skip("A historical reconstruction is selected; mock publication testing must not replace it."); return; }
  const post = async (action: Record<string, unknown>, revision = state.revision, requestId = randomUUID()) => {
    const r = await localFetch(`${base}/api/btc-portfolio/admin`, { method: "POST", headers, body: JSON.stringify({ ...action, revision, requestId }) });
    return { status: r.status, data: await r.json() };
  };
  const crossOrigin = await localFetch(`${base}/api/btc-portfolio/admin`, { method: "POST", headers: { ...headers, origin: "https://untrusted.invalid" }, body: "{}" }); assert.equal(crossOrigin.status, 403);
  const id = `local-qa-${randomUUID()}`, e = { ...newEvent(state.draft.asOf), id, kind: "fee", asset: "USDT", price: "1", quantity: "5", sourceId: `private-source-${id}`, publicReason: "Fictional verification cost.", privateNote: "PRIVATE_HTTP_SENTINEL" };
  const requestId = randomUUID(), beforeRevision = state.revision;
  const saved = await post({ action: "save-event", event: e }, beforeRevision, requestId); assert.equal(saved.status, 200); state = saved.data;
  const retried = await post({ action: "save-event", event: e }, beforeRevision, requestId); assert.equal(retried.data.revision, state.revision);
  assert.equal((await post({ action: "replay" }, beforeRevision)).status, 409);
  assert.deepEqual(await publicRead(), originalPublic);
  const broken = { ...e, id: `${id}-bad`, kind: "sell", asset: "BTC", sourceId: `${id}-bad`, quantity: "9999", price: "100000" };
  assert.equal((await post({ action: "import", events: [broken] })).status, 400);
  assert.equal((await admin()).revision, state.revision);
  assert.equal((await post({ action: "publish", fingerprint: state.fingerprint })).status, 400);
  const replayed = await post({ action: "replay" }); assert.equal(replayed.status, 200); state = replayed.data;
  const published = await post({ action: "publish", fingerprint: state.fingerprint }); assert.equal(published.status, 200); state = published.data;
  const publicResult = await publicRead(); assert.equal(publicResult.release, state.published.release);
  const serialized = JSON.stringify(publicResult); assert.ok(!serialized.includes("PRIVATE_HTTP_SENTINEL")); assert.ok(!serialized.includes(id)); assert.ok(!serialized.includes('"quantity"')); assert.ok(!serialized.includes('"equity"'));
  const html = await (await localFetch(`${base}/portfolio`, { headers })).text(); assert.ok(!html.includes("PRIVATE_HTTP_SENTINEL")); assert.ok(!html.includes("private-source-")); assert.ok(!html.includes('"btcEquivalent"'));
  const restored = await post({ action: "restore", release: originalPublic.release }); assert.equal(restored.status, 200); state = restored.data; assert.deepEqual(await publicRead(), originalPublic);
  const voided = await post({ action: "void", id, reason: "Completed local verification; exclude the fictional QA event." }); assert.equal(voided.status, 200); state = voided.data;
  assert.equal(state.summary.equity, initial.summary.equity);
  const audit = state.audit.find(a => a.action === "Voided transaction")!; assert.equal(audit.before!.voided, false); assert.equal(audit.after!.voided, true);
  assert.equal((await admin()).revision, state.revision);
});
