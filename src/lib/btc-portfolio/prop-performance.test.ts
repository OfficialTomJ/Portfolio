import test from "node:test";
import assert from "node:assert/strict";
import { applyPropResults, combineCurrentPortfolioResults } from "./prop-performance";
const d = (n: number, h = "00") => `2026-01-${String(n).padStart(2, "0")}T${h}:00:00.000Z`;
const marks = (values: number[]) => values.map((portfolioIndex, i) => ({ at: d(i + 1), portfolioIndex, btcIndex: 100 + i * 2, weights: {} }));

test("closed prop contributions use entry equity and do not add notional or reapply recorded costs", () => {
  const spot = marks([100, 105, 110]), before = structuredClone(spot);
  const result = applyPropResults(spot, [{ id: "a", openedAt: d(1, "12"), closedAt: d(2, "12"), resultR: 2 }], .01);
  assert.deepEqual(result.points.map(p => p.portfolioIndex), [100, 105, 112]);
  assert.deepEqual(result.points.map(p => p.btcIndex), spot.map(p => p.btcIndex));
  assert.deepEqual(spot, before); assert.deepEqual(result.journal, [{ id: "a", riskIndex: 1, pnlIndex: 2 }]);
});
test("overlapping trades retain their own entry risk basis instead of compounding in exit order", () => {
  const trades = [{ id: "a", openedAt: d(1, "01"), closedAt: d(2, "01"), resultR: 2 }, { id: "b", openedAt: d(1, "02"), closedAt: d(3, "01"), resultR: 2 }];
  const result = applyPropResults(marks([100, 100, 100, 100]), trades, .01);
  assert.equal(result.points.at(-1)!.portfolioIndex, 104);
  const sequential = applyPropResults(marks([100, 100, 100, 100]), [trades[0], { ...trades[1], openedAt: d(2, "02") }], .01);
  assert.ok(Math.abs(sequential.points.at(-1)!.portfolioIndex - 104.04) < 1e-10);
});
test("entry basis uses the latest available mark, and closing cash is available to same-time entries", () => {
  const result = applyPropResults(marks([100, 120, 120]), [{ id: "a", openedAt: d(1, "12"), closedAt: d(2), resultR: 2 }, { id: "b", openedAt: d(2), closedAt: d(2, "12"), resultR: -1 }], .01);
  assert.equal(result.journal[0].riskIndex, 1); assert.equal(result.journal[1].riskIndex, 1.22);
  assert.ok(Math.abs(result.points.at(-1)!.portfolioIndex - 120.78) < 1e-10);
});
test("duplicates, invalid chronology, incomplete coverage and exhausted equity fail closed", () => {
  const trade = { id: "a", openedAt: d(1, "12"), closedAt: d(2, "12"), resultR: 1 };
  assert.throws(() => applyPropResults(marks([100, 100, 100]), [trade, trade], .01), /Duplicate/);
  assert.throws(() => applyPropResults(marks([100, 100]), [trade], .01), /inside/);
  assert.throws(() => applyPropResults(marks([100, 100, 100]), [{ ...trade, closedAt: d(1) }], .01), /inside/);
  assert.throws(() => applyPropResults(marks([100, 100, 100]), [{ ...trade, resultR: -200 }], .01));
  assert.throws(() => applyPropResults(marks([100, 100, 100]), [trade], NaN));
});


test("settled prop PnL changes cash and the allocation denominator without inventing asset holdings", () => {
  const current = { points: marks([100, 100, 100]), allocation: [{ account: "margin", asset: "BTC", weight: 60, type: "spot", direction: "long" }, { account: "margin", asset: "USD", weight: 40, type: "cash", direction: "long" }], cashPct: 40, investedPct: 60, netPct: 60 } as import("./schema").PublicPortfolio;
  const input = { status: "approved-localhost" as const, method: "spot-and-closed-prop-results" as const, spotFingerprint: "0".repeat(64), inceptionAt: d(1), asOf: d(3), propThrough: d(2, "12"), propTradeCount: 1, points: applyPropResults(current.points, [{ id: "loss", openedAt: d(1, "12"), closedAt: d(2, "12"), resultR: -10 }], .01).points };
  const result = combineCurrentPortfolioResults(current, input);
  assert.ok(Math.abs(result.allocation[0].weight - 60 / 90 * 100) < 1e-10);
  assert.ok(Math.abs(result.cashPct - 30 / 90 * 100) < 1e-10);
  assert.ok(Math.abs(result.investedPct + result.cashPct - 100) < 1e-10);
  assert.equal(current.allocation[0].weight, 60); assert.equal(current.cashPct, 40);
  assert.throws(() => combineCurrentPortfolioResults(current, { ...input, points: input.points.map((p, i) => i ? { ...p, btcIndex: 999 } : p) }), /BTC benchmark/);
});
