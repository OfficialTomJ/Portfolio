import test from "node:test";
import assert from "node:assert/strict";
import { publicSchema } from "./schema";
import { withholdWalletHistory } from "./privacy";
const first = "2026-01-01T00:00:00.000Z", last = "2026-01-03T00:00:00.000Z";
function current() {
  return publicSchema.parse({ mode: "reconstructed", currency: "USD", inceptionAt: first, asOf: last, lastActivityAt: last, publishedAt: null, release: 1,
    points: [{ at: first, portfolioIndex: 100, btcIndex: 100, weights: { BTC: 50 } }, { at: last, portfolioIndex: 110, btcIndex: 105, weights: { BTC: 60 } }],
    allocation: [], cashPct: 40, investedPct: 60, netPct: 60, activity: [], campaigns: [],
    performanceCoverage: { method: "spot-and-closed-prop-results", propThrough: last, propTradeCount: 9, openPropPnlIncluded: false },
    stories: { version: 1, status: "localhost-preview", preparedAt: last, pendingPerformanceYears: [],
      ideas: [{ id: "idea-0123456789abcdef", asset: "BTC", direction: "LONG", at: "2025-04-10T12:34:56.789Z", endAt: "2025-04-11T00:00:00.000Z", title: "PRIVATE_TRADE_THESIS", reason: "PRIVATE_TRADE_REASON", articleUrl: "", articleStatus: "awaiting-publication" }],
      perpTrades: [{ id: "perp-0123456789abcdef", asset: "BTC", direction: "LONG", openedAt: "2025-04-10T12:34:56.789Z", closedAt: "2025-04-11T00:00:00.000Z" }],
    },
  });
}
test("visitor reduction withholds complete trade/idea arrays, historical weights and granular coverage", () => {
  const input = current(), before = structuredClone(input), reduced = withholdWalletHistory(input);
  assert.equal(reduced.stories!.perpTrades.length, 0); assert.equal(reduced.stories!.ideas.length, 0);
  assert.ok(reduced.points.every(point => Object.keys(point.weights).length === 0));
  assert.equal(reduced.performanceCoverage, undefined); assert.equal(reduced.privacy!.publication, "held-for-review");
  for (const secret of ["2025-", "PRIVATE_TRADE", "perp-012345", "idea-012345", "propThrough", "propTradeCount"]) assert.ok(!JSON.stringify(reduced).includes(secret), secret);
  assert.deepEqual(input, before); assert.deepEqual(reduced.points.map(p => p.portfolioIndex), input.points.map(p => p.portfolioIndex));
});
test("a combined wallet-derived curve cannot accidentally enter the visitor reduction", () => {
  const input = current();
  assert.throws(() => withholdWalletHistory({ ...input, history: { method: "linked-performance", priorAsOf: "2025-11-30T00:00:00.000Z", currentInceptionAt: first, cashBridgeAssumed: true } }), /Unlink wallet history/);
});
test("explicit curve approval preserves history without releasing executions or linked ideas", () => {
  const input = current();
  const combined = { ...input, history: { method: "linked-performance" as const, priorAsOf: "2025-11-30T00:00:00.000Z", currentInceptionAt: first, cashBridgeAssumed: true as const } };
  const before = structuredClone(combined);
  const reduced = withholdWalletHistory(combined, { walletCurveApproved: true });
  assert.deepEqual(reduced.history, combined.history);
  assert.deepEqual(reduced.points.map(({ at, portfolioIndex, btcIndex }) => ({ at, portfolioIndex, btcIndex })), combined.points.map(({ at, portfolioIndex, btcIndex }) => ({ at, portfolioIndex, btcIndex })));
  assert.deepEqual(reduced.privacy, { publication: "localhost-preview", walletHistory: "curve-only", tradeRecords: "private-only", tradeLinkedIdeas: "private-only" });
  assert.deepEqual(reduced.stories!.ideas, []);
  assert.deepEqual(reduced.stories!.perpTrades, []);
  assert.deepEqual(reduced.activity, []);
  assert.deepEqual(reduced.campaigns, []);
  assert.equal(reduced.performanceCoverage, undefined);
  assert.ok(reduced.points.every(point => Object.keys(point.weights).length === 0));
  assert.ok(!JSON.stringify(reduced).includes("PRIVATE_TRADE"));
  assert.deepEqual(combined, before);
});
