import assert from "node:assert/strict";
import test from "node:test";
import { assemblePrivateClosedLedger, type PrivateClosedLedgerCycle } from "./admin-ledger";
const openedAt = new Date("2026-01-01T00:00:00Z"), closedAt = new Date("2026-01-01T01:00:00Z");
const cycle: PrivateClosedLedgerCycle = { _id: "cycle", symbol: "BTCUSDT", direction: "Short", status: "excluded", openedAt, closedAt, entryPrice: 100, riskAmount: 1000, excludedFromJournal: true };
const slice = { cycleId: "cycle", closedPnl: -22.84, avgEntryPrice: 100, avgExitPrice: 110, closedSize: 1, qty: 1, updatedTime: closedAt.getTime() };
test("includes exceptions privately and explicitly marks them read-only", () => {
  const result = assemblePrivateClosedLedger([cycle], [slice], []);
  assert.equal(result.trades[0].resultR, -0.02284);
  assert.equal(result.readOnlyClosedTrades[0].reason, "exception");
  assert.equal(cycle.status, "excluded");
});
test("accepts a final PnL timestamp that trails its execution timestamp", () => {
  const result = assemblePrivateClosedLedger([{ ...cycle, executionClosedAt: new Date(closedAt.getTime() - 1) }], [slice], []);
  assert.equal(result.trades.length, 1);
});
test("counts a fully closed held trade without permitting publication or duplicating a public trade", () => {
  const result = assemblePrivateClosedLedger([{ ...cycle, excludedFromJournal: false, status: "awaiting_attribution", publicationHold: true }], [slice], []);
  assert.equal(result.readOnlyClosedTrades[0].reason, "reconciliation");
  assert.equal(assemblePrivateClosedLedger([cycle], [slice], result.trades).trades.length, 0);
});
test("does not count active, unbounded, missing-risk or post-boundary slices", () => {
  assert.equal(assemblePrivateClosedLedger([{ ...cycle, status: "open" }], [slice], []).trades.length, 0);
  assert.equal(assemblePrivateClosedLedger([{ ...cycle, closedAt: undefined }], [slice], []).trades.length, 0);
  assert.equal(assemblePrivateClosedLedger([{ ...cycle, riskAmount: undefined }], [slice], []).trades.length, 0);
  assert.equal(assemblePrivateClosedLedger([cycle], [{ ...slice, updatedTime: closedAt.getTime() + 1000 }], []).trades.length, 0);
});
