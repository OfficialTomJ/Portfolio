import test from "node:test";
import assert from "node:assert/strict";
import { replayPortfolio } from "./engine";
import { makeMockLedger } from "./fixture";
import { visitorPortfolio } from "./visitor-projection";

test("visitor reads strip legacy executions, historical exposure and custody details without changing returns", () => {
  const source = replayPortfolio(makeMockLedger()).publicData;
  source.allocation = [
    { account: "cold", asset: "BTC", type: "spot", direction: "long", weight: 20 },
    { account: "margin", asset: "BTC", type: "spot", direction: "long", weight: 30 },
  ];
  source.stories = { version: 1, status: "localhost-preview", preparedAt: source.asOf, ideas: [], perpTrades: [{ id: "perp-" + "a".repeat(16), asset: "BTC", direction: "LONG", openedAt: source.inceptionAt, closedAt: source.asOf }], pendingPerformanceYears: [] };
  source.performanceCoverage = { method: "spot-and-closed-prop-results", propThrough: source.asOf, propTradeCount: 4, openPropPnlIncluded: false };
  source.editorialNotes = [{ id: "note-" + "b".repeat(16), asset: "BTC", period: "2026-01", title: "Patient accumulation", reason: "Added during weakness.", articleUrl: "" }];
  const before = structuredClone(source);
  const output = visitorPortfolio({ ...source, wallet: "PRIVATE_WALLET_SENTINEL", capital: "PRIVATE_CAPITAL_SENTINEL", privateNotes: "PRIVATE_NOTE_SENTINEL", allocation: source.allocation.map(row => ({ ...row, quantity: "PRIVATE_QUANTITY_SENTINEL" })) });
  assert.deepEqual(source, before);
  assert.equal(output.lastActivityAt, output.asOf);
  assert.deepEqual(output.activity, []); assert.deepEqual(output.campaigns, []);
  assert.equal(output.stories, undefined); assert.equal(output.performanceCoverage, undefined);
  assert(output.points.every(row => Object.keys(row.weights).length === 0));
  assert.deepEqual(output.points.map(({ at, portfolioIndex, btcIndex }) => ({ at, portfolioIndex, btcIndex })), source.points.map(({ at, portfolioIndex, btcIndex }) => ({ at, portfolioIndex, btcIndex })));
  assert.deepEqual(output.allocation, [{ account: "margin", asset: "BTC", type: "spot", direction: "long", weight: 50 }]);
  assert.deepEqual(output.editorialNotes, source.editorialNotes);
  assert(!JSON.stringify(output).includes("PRIVATE_"));
  assert.throws(() => visitorPortfolio({ ...source, allocation: [{ ...source.allocation[0], asset: "PRIVATE_WALLET_SENTINEL" }] }));
});
