import assert from "node:assert/strict";
import test from "node:test";
import { normalizeClosedCycle } from "./normalize";

const openedAt = new Date("2026-09-10T00:00:00.000Z");

test("normalizes a long trade from net PnL and captured initial risk", () => {
  const result = normalizeClosedCycle(
    {
      id: "long-trade",
      symbol: "BTCUSDT",
      direction: "Long",
      openedAt,
      fallbackEntryPrice: 100,
      initialStopPrice: 90,
    },
    [{
      avgEntryPrice: 100,
      avgExitPrice: 120,
      closedSize: 2,
      qty: 2,
      closedPnl: 38,
      updatedTime: Date.parse("2026-09-12T00:00:00.000Z"),
    }]
  );

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.trade.resultR, 1.9);
});

test("weights partial exits without exposing quantity in the public trade", () => {
  const result = normalizeClosedCycle(
    {
      id: "short-trade",
      symbol: "ETHUSDT",
      direction: "Short",
      openedAt,
      fallbackEntryPrice: 200,
      initialStopPrice: 210,
    },
    [
      { avgEntryPrice: 200, avgExitPrice: 190, closedSize: 1, qty: 1, closedPnl: 9, updatedTime: 1_000 },
      { avgEntryPrice: 200, avgExitPrice: 180, closedSize: 3, qty: 3, closedPnl: 57, updatedTime: 2_000 },
    ]
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.trade.exitPrice, 182.5);
  assert.equal(result.trade.resultR, 1.65);
  assert.deepEqual(Object.keys(result.trade).sort(), [
    "closedAt",
    "direction",
    "entryPrice",
    "exitPrice",
    "id",
    "openedAt",
    "resultR",
    "symbol",
  ]);
});

test("refuses to publish when the initial stop was not captured", () => {
  const result = normalizeClosedCycle(
    {
      id: "missing-risk",
      symbol: "SOLUSDT",
      direction: "Long",
      openedAt,
      fallbackEntryPrice: 100,
    },
    [{ avgEntryPrice: 100, avgExitPrice: 120, closedSize: 1, qty: 1, closedPnl: 20, updatedTime: 2_000 }]
  );

  assert.deepEqual(result, { ok: false, reason: "missing_stop" });
});

test("refuses a stop on the wrong side of the entry", () => {
  const result = normalizeClosedCycle(
    {
      id: "invalid-risk",
      symbol: "BTCUSDT",
      direction: "Short",
      openedAt,
      fallbackEntryPrice: 100,
      initialStopPrice: 90,
    },
    [{ avgEntryPrice: 100, avgExitPrice: 80, closedSize: 1, qty: 1, closedPnl: 20, updatedTime: 2_000 }]
  );

  assert.deepEqual(result, { ok: false, reason: "invalid_risk" });
});
