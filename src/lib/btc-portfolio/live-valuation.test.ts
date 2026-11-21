import test from "node:test";
import assert from "node:assert/strict";
import { createValuationBasis, revaluePortfolio, valuationAssets } from "./live-valuation";
import { publicSchema, type PublicPortfolio } from "./schema";
import type { MarketAsset, MarketQuote } from "./market-prices";
import { makeMockLedger } from "./fixture";

const start = "2026-01-01T00:00:00.000Z", baseAt = "2026-11-14T00:00:00.000Z", tickAt = "2026-11-21T01:00:00.000Z";
const now = Date.parse(tickAt);
function sample(): PublicPortfolio {
  return publicSchema.parse({ mode: "reconstructed", currency: "USD", inceptionAt: start, asOf: baseAt, lastActivityAt: baseAt, publishedAt: baseAt, release: 1,
    points: [{ at: start, portfolioIndex: 100, btcIndex: 100, weights: {} }, { at: baseAt, portfolioIndex: 200, btcIndex: 150, weights: {} }],
    allocation: [{ account: "margin", asset: "BTC", type: "spot", direction: "long", weight: 70 }, { account: "margin", asset: "USD", type: "cash", direction: "long", weight: 30 }],
    cashPct: 30, investedPct: 70, netPct: 70, activity: [], campaigns: [],
    valuation: { method: "market-prices", status: "delayed", holdingsAsOf: baseAt, prices: { BTC: 100 } },
  });
}
const quote = (asset: MarketAsset, price: number, at = tickAt): MarketQuote => ({ asset, price, at, currency: "USD" });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("spot and cash revaluation advances return, benchmark and allocations at the same source time", () => {
  const data = sample(), before = structuredClone(data), result = revaluePortfolio(data, { BTC: quote("BTC", 110) }, now);
  assert.equal(result.asOf, tickAt); near(result.points.at(-1)!.portfolioIndex, 214); near(result.points.at(-1)!.btcIndex, 165);
  near(result.investedPct, 77 / 107 * 100); near(result.cashPct, 30 / 107 * 100);
  near(result.allocation.reduce((sum, row) => sum + row.weight, 0), 100);
  assert.deepEqual(result.points.slice(0, -1), before.points); assert.deepEqual(data, before);
  assert.equal(result.valuation!.holdingsAsOf, baseAt); assert.equal(result.valuation!.status, "live");
  assert.equal(result.publishedAt, baseAt); assert.equal(result.release, 1);
});

test("ticks never double-count growth or accumulate provisional history", () => {
  const initial = sample(), once = revaluePortfolio(initial, { BTC: quote("BTC", 110) }, now);
  const again = revaluePortfolio(once, { BTC: quote("BTC", 110) }, now);
  assert.deepEqual(again.points, once.points); near(again.investedPct, once.investedPct);
  const next = revaluePortfolio(once, { BTC: quote("BTC", 120, "2026-11-21T01:00:01.000Z") }, now + 1000);
  near(next.points.at(-1)!.portfolioIndex, 228); near(next.points.at(-1)!.btcIndex, 180);
  assert.equal(next.points.length, initial.points.length + 1); assert.deepEqual(next.points.slice(0, -1), initial.points);
});

test("all assets and benchmark need fresh USD prices; stale, partial and older ticks cannot advance", () => {
  const data = sample();
  data.allocation[0].weight = 40; data.allocation.push({ account: "margin", asset: "ETH", type: "spot", direction: "long", weight: 30 }); data.valuation!.prices.ETH = 20;
  assert.deepEqual(valuationAssets(data), ["BTC", "ETH"]);
  assert.throws(() => revaluePortfolio(data, { BTC: quote("BTC", 110) }, now));
  for (const bad of [quote("BTC", 0), quote("BTC", NaN), quote("BTC", 110, baseAt), quote("BTC", 110, "2026-11-21T01:02:00.000Z"), { ...quote("BTC", 110), currency: "EUR" }]) {
    assert.throws(() => revaluePortfolio(sample(), { BTC: bad as MarketQuote }, now));
  }
  const result = revaluePortfolio(data, { BTC: quote("BTC", 110), ETH: quote("ETH", 18) }, now);
  near(result.points.at(-1)!.portfolioIndex, 202); near(result.cashPct, 30 / 101 * 100);
  const allCash = sample(); allCash.allocation = [allCash.allocation[1]]; allCash.allocation[0].weight = 100; allCash.cashPct = 100; allCash.investedPct = allCash.netPct = 0;
  assert.deepEqual(valuationAssets(allCash), ["BTC"]);
  const cashResult = revaluePortfolio(allCash, { BTC: quote("BTC", 110) }, now);
  near(cashResult.points.at(-1)!.portfolioIndex, 200); near(cashResult.points.at(-1)!.btcIndex, 165);
});

test("unreconciled allocations, leverage, unsupported currencies and mismatched price anchors fail closed", () => {
  for (const edit of [(d: PublicPortfolio) => { d.currency = "USDT"; }, (d: PublicPortfolio) => { d.allocation[0].type = "margin"; }, (d: PublicPortfolio) => { d.allocation[0].weight = 69; }, (d: PublicPortfolio) => { d.allocation[0].asset = "UNKNOWN"; }]) {
    const data = sample(); edit(data); assert.throws(() => valuationAssets(data));
  }
  const ledger = makeMockLedger(); ledger.asOf = baseAt; ledger.marks = [{ asset: "BTC", at: baseAt, price: "100" }];
  assert.deepEqual(createValuationBasis(sample(), ledger), { asOf: baseAt, prices: { BTC: 100 } });
  assert.throws(() => createValuationBasis(sample(), { ...ledger, asOf: start }));
  assert.throws(() => createValuationBasis(sample(), { ...ledger, marks: [{ asset: "BTC", at: start, price: "100" }] }));
});

test("live output strips private source fields and publishes only relative values and public prices", () => {
  const data = sample(), withPrivate = { ...data, quantity: "PRIVATE_QUANTITY", wallet: "PRIVATE_WALLET", capital: "PRIVATE_CAPITAL" };
  const result = revaluePortfolio(withPrivate, { BTC: { ...quote("BTC", 110), quantity: "PRIVATE_TRADE" } as MarketQuote }, now);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_")); assert.ok(result.points.every(p => !Object.keys(p.weights).length));
  assert.deepEqual(result.valuation!.prices, { BTC: 110 });
});
