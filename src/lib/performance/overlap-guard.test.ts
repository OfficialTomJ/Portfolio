import assert from "node:assert/strict";
import test from "node:test";
import type { BybitExecution, BybitPosition } from "./bybit";
import {
  currentPositionOpeningOrderIds,
  hasMultipleOpeningOrdersInCycle,
  hasOverlappingPositionEntries,
} from "./overlap-guard";

const openedAt = Date.parse("2026-09-25T20:00:00.000Z");

function position(overrides: Partial<BybitPosition> = {}): BybitPosition {
  return {
    symbol: "BTCUSDT",
    side: "Buy",
    size: "10",
    avgPrice: "90",
    positionIdx: 0,
    stopLoss: "85",
    takeProfit: "100",
    leverage: "5",
    createdTime: String(openedAt),
    updatedTime: String(openedAt),
    openTime: String(openedAt),
    ...overrides,
  };
}

function execution(
  orderId: string,
  side: "Buy" | "Sell",
  qty: number,
  seconds: number,
  overrides: Partial<BybitExecution> = {}
): BybitExecution {
  return {
    execId: `${orderId}-${seconds}`,
    orderId,
    orderLinkId: "",
    symbol: "BTCUSDT",
    side,
    execPrice: "90",
    execQty: String(qty),
    execValue: String(qty * 90),
    execFee: "0",
    execTime: String(openedAt + seconds * 1000),
    execType: "Trade",
    orderType: "Market",
    stopOrderType: "",
    closedSize: side === "Sell" ? String(qty) : "0",
    seq: seconds,
    ...overrides,
  };
}

test("partial fills of one entry order are not treated as overlapping trades", () => {
  const executions = [
    execution("entry", "Buy", 4, 1),
    execution("entry", "Buy", 6, 2),
  ];
  assert.deepEqual([...currentPositionOpeningOrderIds(position(), executions)], ["entry"]);
  assert.equal(hasOverlappingPositionEntries({
    cycleId: "cycle-a",
    position: position(),
    priorOpenCycles: [{ id: "cycle-a", quantity: 10, entryPrice: 90 }],
    executions,
  }), false);
});

test("a separate entry order holds publication while both legs remain open", () => {
  const executions = [
    execution("entry", "Buy", 10, 1),
    execution("addition", "Buy", 5, 60),
  ];
  assert.equal(hasOverlappingPositionEntries({
    cycleId: "cycle-a",
    position: position({ size: "15" }),
    priorOpenCycles: [{ id: "cycle-a", quantity: 10, entryPrice: 90 }],
    executions,
  }), true);
});

test("an added entry and exit between syncs still holds the remaining exposure", () => {
  const executions = [
    execution("entry", "Buy", 10, 1),
    execution("addition", "Buy", 5, 60),
    execution("partial-exit", "Sell", 5, 120),
  ];
  assert.deepEqual(
    [...currentPositionOpeningOrderIds(position(), executions)].sort(),
    ["addition", "entry"]
  );
  assert.equal(hasOverlappingPositionEntries({
    cycleId: "cycle-a",
    position: position(),
    priorOpenCycles: [{ id: "cycle-a", quantity: 10, entryPrice: 90 }],
    executions,
  }), true);
});

test("changed Bybit opening timestamp and an existing hold both fail closed", () => {
  const priorOpenCycles = [{ id: "cycle-a", quantity: 10, entryPrice: 90 }];
  assert.equal(hasOverlappingPositionEntries({
    cycleId: "cycle-b",
    position: position({ openTime: String(openedAt + 60_000) }),
    priorOpenCycles,
    executions: [],
  }), true);
  assert.equal(hasOverlappingPositionEntries({
    cycleId: "cycle-a",
    position: position(),
    priorOpenCycles: [{ ...priorOpenCycles[0], publicationHold: true }],
    executions: [],
  }), true);
});

test("a size increase without available execution history still fails closed", () => {
  assert.equal(hasOverlappingPositionEntries({
    cycleId: "cycle-a",
    position: position({ size: "15" }),
    priorOpenCycles: [{ id: "cycle-a", quantity: 10, entryPrice: 90 }],
    executions: [],
  }), true);
});

test("a fully closed overlapping cycle is held, but a later separate trade is not", () => {
  const executions = [
    execution("entry", "Buy", 10, 1),
    execution("addition", "Buy", 5, 60),
    execution("close", "Sell", 15, 120),
    execution("later", "Buy", 2, 180),
  ];
  assert.equal(hasMultipleOpeningOrdersInCycle({
    symbol: "BTCUSDT",
    side: "Buy",
    openedAt: new Date(openedAt),
    closedAt: new Date(openedAt + 120_000),
    executions,
  }), true);
  assert.equal(hasMultipleOpeningOrdersInCycle({
    symbol: "BTCUSDT",
    side: "Buy",
    openedAt: new Date(openedAt + 180_000),
    closedAt: new Date(openedAt + 240_000),
    executions,
  }), false);
});

test("a short add is guarded using the sell-side entry orders", () => {
  const executions = [
    execution("entry", "Sell", 10, 1, { closedSize: "0" }),
    execution("addition", "Sell", 5, 60, { closedSize: "0" }),
    execution("partial-exit", "Buy", 5, 120, { closedSize: "5" }),
  ];
  assert.equal(currentPositionOpeningOrderIds(
    position({ side: "Sell", size: "10" }), executions
  ).size, 2);
});
