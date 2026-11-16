import test from "node:test";
import assert from "node:assert/strict";
import { combinePortfolioHistory, localChartHistorySchema, type LocalChartHistory } from "./history";
import { publicSchema, type PublicPortfolio } from "./schema";
import { metrics, periodPoints, portfolioYears } from "./view";
import { fetchPortfolioSnapshot } from "./refresh";

function current(): PublicPortfolio {
  return publicSchema.parse({ mode: "reconstructed", currency: "USD", inceptionAt: "2026-01-01T00:00:00.000Z", asOf: "2026-01-02T00:00:00.000Z",
    lastActivityAt: "2026-01-01T00:00:00.000Z", publishedAt: null, release: 1,
    points: [{ at: "2026-01-01T00:00:00.000Z", portfolioIndex: 100, btcIndex: 100, weights: { BTC: 50 } },
      { at: "2026-01-02T00:00:00.000Z", portfolioIndex: 110, btcIndex: 90, weights: { BTC: 55 } }],
    allocation: [{ account: "margin", asset: "BTC", weight: 55, type: "spot", direction: "long" }],
    cashPct: 45, investedPct: 55, netPct: 55, activity: [], campaigns: [],
  });
}
function history(): LocalChartHistory {
  return { version: 1, status: "approved-localhost", historical: [
    { at: "2025-04-01T00:00:00.000Z", portfolioIndex: 100, btcIndex: 100 },
    { at: "2025-11-01T00:00:00.000Z", portfolioIndex: 120, btcIndex: 110 }],
    bridge: [{ at: "2025-12-01T00:00:00.000Z", btcIndex: 105 }],
    currentInceptionAt: "2026-01-01T00:00:00.000Z", currentBtcIndexAtInception: 120 };
}
test("linked growth compounds once, preserves cash continuity and independently links the BTC benchmark", () => {
  const input = current(), before = structuredClone(input), result = combinePortfolioHistory(input, history());
  assert.equal(result.points.length, 5);
  assert.deepEqual(result.points.map(p => p.portfolioIndex), [100, 120, 120, 120, 132]);
  assert.deepEqual(result.points.map(p => p.btcIndex), [100, 110, 105, 120, 108]);
  assert.deepEqual(result.allocation, input.allocation);
  assert.deepEqual(result.activity, input.activity);
  assert.equal(result.cashPct, input.cashPct);
  assert.deepEqual(input, before);
  assert.ok(Math.abs(metrics(result.points)!.portfolio - 32) < 1e-10);
  assert.ok(Math.abs(metrics(periodPoints(result, "YTD", "", ""))!.portfolio - 10) < 1e-10);
});
test("history rejects overlapping dates, a mismatched base and accidental double linking", () => {
  const h = history();
  assert.throws(() => combinePortfolioHistory(current(), { ...h, bridge: [{ at: h.currentInceptionAt, btcIndex: 100 }] }), /overlap/);
  assert.throws(() => combinePortfolioHistory(current(), { ...h, currentInceptionAt: "2026-02-01T00:00:00.000Z" }), /original/);
  assert.throws(() => combinePortfolioHistory(combinePortfolioHistory(current(), h), h), /original/);
  assert.equal(localChartHistorySchema.safeParse({ ...h, capital: "PRIVATE" }).success, false);
  assert.equal(localChartHistorySchema.safeParse({ ...h, historical: [{ ...h.historical[0], wallet: "PRIVATE" }, h.historical[1]] }).success, false);
});
test("automatic refresh retains the complete linked chart and its coverage metadata", async () => {
  const linked = combinePortfolioHistory(current(), history());
  const result = await fetchPortfolioSnapshot(new AbortController().signal, async () => new Response(JSON.stringify({ ...linked, privateNote: "PRIVATE" }), { status: 200 }));
  assert.deepEqual(result.data, linked);
  assert.equal(JSON.stringify(result.data).includes("PRIVATE"), false);
});
test("individual years and custom dates include exact UTC boundaries and exclude adjacent years", () => {
  const dates = ["2025-12-31T23:59:59.999Z", "2026-01-01T00:00:00.000Z", "2026-12-31T23:59:59.999Z", "2027-01-01T00:00:00.000Z", "2027-01-02T00:00:00.000Z"];
  const data = { ...current(), inceptionAt: dates[0], asOf: dates.at(-1)!, points: dates.map((at, i) => ({ at, portfolioIndex: 100 + i * 10, btcIndex: 100, weights: {} })) };
  assert.deepEqual(portfolioYears(data), [2027, 2026, 2025]);
  assert.deepEqual(periodPoints(data, "YEAR:2026", "", "").map(p => p.at), dates.slice(1, 3));
  assert.deepEqual(periodPoints(data, "YEAR:2025", "", "").map(p => p.at), dates.slice(0, 1));
  assert.deepEqual(periodPoints(data, "YTD", "", "").map(p => p.at), dates.slice(3));
  assert.deepEqual(periodPoints(data, "CUSTOM", "2026-12-31", "2026-12-31").map(p => p.at), dates.slice(2, 3));
});
