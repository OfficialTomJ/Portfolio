import test from "node:test";
import assert from "node:assert/strict";
import { createLivePortfolioReader } from "./live-reader";
import { replayPortfolio } from "./engine";
import { makeMockLedger } from "./fixture";

test("live readers retain the last good valuation on provider failure, recover, and invalidate it on release changes", async () => {
  const data = replayPortfolio(makeMockLedger()).publicData;
  data.currency = "USD";
  data.allocation = [{ account: "margin", asset: "USD", weight: 30, type: "cash", direction: "long" }, { account: "margin", asset: "BTC", weight: 70, type: "spot", direction: "long" }];
  data.cashPct = 30; data.investedPct = data.netPct = 70;
  let id = "release-a", failure = false, missing = false, time = Date.parse(data.asOf) + 1000, price = 110;
  const read = createLivePortfolioReader({ readRelease: async () => ({ id, data }), readBasis: async () => missing ? null : { asOf: data.asOf, prices: { BTC: 100 } },
    quote: async asset => { if (failure) throw new Error("Provider failed"); return { asset, price, at: new Date(time).toISOString(), currency: "USD" }; }, now: () => time });
  const first = await read(); assert.equal(first.valuation?.status, "live");
  failure = true; const held = await read(); assert.equal(held.valuation?.status, "delayed"); assert.equal(held.asOf, first.asOf); assert.deepEqual(held.points, first.points);
  failure = false; time += 1000; price = 120; const recovered = await read(); assert.equal(recovered.valuation?.status, "live"); assert.ok(recovered.points.at(-1)!.portfolioIndex > first.points.at(-1)!.portfolioIndex);
  id = "release-b"; missing = true; const changed = await read(); assert.equal(changed.valuation?.status, "delayed"); assert.equal(changed.asOf, data.asOf); assert.deepEqual(changed.points, data.points);
});

test("missing or mismatched bases fail closed before any market request", async () => {
  const data = replayPortfolio(makeMockLedger()).publicData;
  for (const basis of [null, { asOf: data.inceptionAt, prices: { BTC: 100 } }]) {
    const read = createLivePortfolioReader({ readRelease: async () => ({ id: "release", data }), readBasis: async () => basis, quote: async () => assert.fail("Unexpected market request") });
    const result = await read(); assert.equal(result.asOf, data.asOf); assert.equal(result.valuation?.status, "delayed");
  }
});
