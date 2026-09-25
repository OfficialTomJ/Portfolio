import assert from "node:assert/strict";
import test from "node:test";
import type { BybitSnapshot } from "./bybit";
import {
  assertValidPerformanceSnapshot,
  validatePublishedPerformanceTrade,
} from "./sync-validation";

function snapshot(): BybitSnapshot {
  return {
    environment: "demo",
    serverTime: Date.parse("2026-09-20T00:00:00.000Z"),
    apiKey: { userID: 123, readOnly: 1 },
    positions: [],
    executions: [
      {
        execId: "execution-1",
        orderId: "order-open",
        orderLinkId: "",
        symbol: "BTCUSDT",
        side: "Sell",
        execPrice: "50000",
        execQty: "1",
        execValue: "50000",
        execFee: "1",
        execTime: String(Date.parse("2025-01-02T03:00:00.000Z")),
        execType: "Trade",
        orderType: "Market",
        stopOrderType: "",
        closedSize: "0",
        seq: 1,
      },
    ],
    orders: [],
    openOrders: [],
    closedPnl: [
      {
        orderId: "order-close",
        symbol: "BTCUSDT",
        side: "Buy",
        qty: "1",
        closedSize: "1",
        avgEntryPrice: "50000",
        avgExitPrice: "50500",
        closedPnl: "-125",
        execType: "Trade",
        createdTime: String(Date.parse("2025-01-03T14:00:00.000Z")),
        updatedTime: String(Date.parse("2025-01-03T14:00:00.000Z")),
      },
    ],
  };
}

test("accepts a well-formed Bybit snapshot", () => {
  assert.doesNotThrow(() => assertValidPerformanceSnapshot(snapshot()));
});

test("rejects malformed closed PnL before any write", () => {
  const value = snapshot();
  value.closedPnl[0].avgExitPrice = "0";
  assert.throws(
    () => assertValidPerformanceSnapshot(value),
    /invalid closed PnL record/
  );
});

test("rejects duplicate upstream identifiers", () => {
  const value = snapshot();
  value.executions.push({ ...value.executions[0] });
  assert.throws(
    () => assertValidPerformanceSnapshot(value),
    /duplicate execution IDs/
  );
});

test("validates live conditional orders before archiving and ingestion", () => {
  const value = snapshot();
  value.openOrders = [{
    orderId: "stop-1",
    orderLinkId: "",
    symbol: "BTCUSDT",
    side: "Buy",
    positionIdx: 0,
    orderStatus: "Untriggered",
    orderType: "Market",
    stopOrderType: "StopLoss",
    tpslMode: "Partial",
    triggerPrice: "49000",
    takeProfit: "",
    stopLoss: "49000",
    reduceOnly: true,
    closeOnTrigger: true,
    qty: "1",
    cumExecQty: "0",
    avgPrice: "",
    createdTime: String(Date.parse("2026-09-20T00:00:00.000Z")),
    updatedTime: String(Date.parse("2026-09-20T00:00:00.000Z")),
  }];
  assert.doesNotThrow(() => assertValidPerformanceSnapshot(value));
  value.openOrders[0].positionIdx = Number.NaN;
  assert.throws(() => assertValidPerformanceSnapshot(value), /invalid order/);
});

test("accepts a safe public trade", () => {
  assert.equal(
    validatePublishedPerformanceTrade({
      id: "trade-0123456789abcdef0123",
      symbol: "BTCUSDT",
      direction: "Short",
      openedAt: "2025-01-02T03:00:00.000Z",
      closedAt: "2025-01-03T14:00:00.000Z",
      entryPrice: 50000,
      exitPrice: 50500,
      resultR: -0.25,
    }),
    null
  );
});

test("rejects public trades with unsafe values", () => {
  assert.match(
    validatePublishedPerformanceTrade({
      id: "trade-0123456789abcdef0123",
      symbol: "BTCUSDT",
      direction: "Short",
      openedAt: "2025-01-03T14:00:00.000Z",
      closedAt: "2025-01-02T03:00:00.000Z",
      entryPrice: 50000,
      exitPrice: 50500,
      resultR: -0.25,
    }) ?? "",
    /dates/
  );

  assert.match(
    validatePublishedPerformanceTrade({
      id: "trade-0123456789abcdef0123",
      symbol: "BTCUSDT",
      direction: "Short",
      openedAt: "2025-01-02T03:00:00.000Z",
      closedAt: "2025-01-03T14:00:00.000Z",
      entryPrice: 50000,
      exitPrice: 50500,
      resultR: 101,
    }) ?? "",
    /safety range/
  );
});
