import test from "node:test";
import assert from "node:assert/strict";
import { createMarketQuoteLoader, fetchMarketQuote } from "./market-rest";

const now = Date.parse("2026-11-21T01:00:00.000Z");
const payload = (price = "100", time = now / 1000) => ({ error: [], result: { XXBTZUSD: [[price, "PRIVATE_VOLUME", time, "b", "m", "", 123]], last: "cursor" } });
test("public REST quotes use source timestamps and never expose trade volume", async () => {
  const result = await fetchMarketQuote("BTC", async (url, options) => {
    assert.equal(url, "https://api.kraken.com/0/public/Trades?pair=XBTUSD&count=1"); assert.equal(options?.cache, "no-store"); assert.ok(options?.signal);
    return Response.json(payload());
  }, () => now);
  assert.deepEqual(result, { asset: "BTC", price: 100, at: new Date(now).toISOString(), currency: "USD" });
  for (const body of [payload("0"), payload("NaN"), payload("100", now / 1000 - 121), payload("100", now / 1000 + 61), { error: ["Rate limited"], result: {} }, { error: [], result: { XBTEUR: payload().result.XXBTZUSD } }]) {
    await assert.rejects(fetchMarketQuote("BTC", async () => Response.json(body), () => now));
  }
  await assert.rejects(fetchMarketQuote("BTC", async () => new Response(null, { status: 503 }), () => now));
});
test("market requests deduplicate bursts, expire and recover after failure", async () => {
  let calls = 0, clock = now, fail = false;
  const loader = createMarketQuoteLoader(async () => { calls++; if (fail) throw new Error("Unavailable"); return Response.json(payload("100", clock / 1000)); }, () => clock);
  const [a, b] = await Promise.all([loader("BTC"), loader("BTC")]); assert.deepEqual(a, b); assert.equal(calls, 1);
  await loader("BTC"); assert.equal(calls, 1);
  clock += 5001; fail = true; await assert.rejects(loader("BTC")); assert.equal(calls, 2);
  fail = false; await loader("BTC"); assert.equal(calls, 3);
});
