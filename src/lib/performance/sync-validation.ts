import type { BybitSnapshot } from "./bybit";
import type { PerformanceTrade } from "./types";

const SYMBOL_PATTERN = /^[A-Z0-9]{3,30}$/;
const MAX_ABSOLUTE_R = 100;

function finitePositive(value: string | number | undefined): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function finiteTimestamp(value: string | number | undefined): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Bybit snapshot contains duplicate ${label}`);
  }
}

/** Reject malformed upstream data before any MongoDB collection is mutated. */
export function assertValidPerformanceSnapshot(snapshot: BybitSnapshot): void {
  if (!snapshot.apiKey?.userID || snapshot.apiKey.readOnly !== 1) {
    throw new Error("Bybit snapshot account identity is invalid");
  }
  if (!finiteTimestamp(snapshot.serverTime)) {
    throw new Error("Bybit snapshot server time is invalid");
  }
  if (
    !Array.isArray(snapshot.positions) ||
    !Array.isArray(snapshot.executions) ||
    !Array.isArray(snapshot.orders) ||
    !Array.isArray(snapshot.openOrders) ||
    !Array.isArray(snapshot.closedPnl)
  ) {
    throw new Error("Bybit snapshot collections are invalid");
  }

  for (const position of snapshot.positions) {
    if (
      !SYMBOL_PATTERN.test(position.symbol) ||
      !["Buy", "Sell"].includes(position.side) ||
      !finitePositive(position.size) ||
      !finitePositive(position.avgPrice) ||
      !Number.isInteger(position.positionIdx)
    ) {
      throw new Error("Bybit snapshot contains an invalid open position");
    }
  }

  for (const execution of snapshot.executions) {
    if (
      !execution.execId ||
      !execution.orderId ||
      !SYMBOL_PATTERN.test(execution.symbol) ||
      !["Buy", "Sell"].includes(execution.side) ||
      !finiteTimestamp(execution.execTime) ||
      (execution.execType === "Trade" &&
        (!finitePositive(execution.execPrice) || !finitePositive(execution.execQty)))
    ) {
      throw new Error("Bybit snapshot contains an invalid execution");
    }
  }

  for (const order of [...snapshot.orders, ...snapshot.openOrders]) {
    if (
      !order.orderId ||
      !SYMBOL_PATTERN.test(order.symbol) ||
      !["Buy", "Sell"].includes(order.side) ||
      !Number.isInteger(order.positionIdx) ||
      !finiteTimestamp(order.createdTime) ||
      !finiteTimestamp(order.updatedTime)
    ) {
      throw new Error("Bybit snapshot contains an invalid order");
    }
  }

  for (const record of snapshot.closedPnl) {
    if (
      !record.orderId ||
      !SYMBOL_PATTERN.test(record.symbol) ||
      !["Buy", "Sell"].includes(record.side) ||
      !finiteTimestamp(record.updatedTime) ||
      (record.execType === "Trade" &&
        (!finitePositive(record.closedSize || record.qty) ||
          !finitePositive(record.avgEntryPrice) ||
          !finitePositive(record.avgExitPrice) ||
          !Number.isFinite(Number(record.closedPnl))))
    ) {
      throw new Error("Bybit snapshot contains an invalid closed PnL record");
    }
  }

  assertUnique(snapshot.executions.map((item) => item.execId), "execution IDs");
  assertUnique(snapshot.orders.map((item) => item.orderId), "order IDs");
  assertUnique(snapshot.openOrders.map((item) => item.orderId), "open order IDs");
  assertUnique(snapshot.closedPnl.map((item) => item.orderId), "closed PnL IDs");
}

/** Final guardrail before a normalized trade becomes publicly visible. */
export function validatePublishedPerformanceTrade(trade: PerformanceTrade): string | null {
  const openedAt = Date.parse(trade.openedAt);
  const closedAt = Date.parse(trade.closedAt);

  if (!/^trade-[a-f0-9]{20}$/.test(trade.id)) return "Trade ID is invalid";
  if (!SYMBOL_PATTERN.test(trade.symbol)) return "Trade symbol is invalid";
  if (trade.direction !== "Long" && trade.direction !== "Short") return "Trade direction is invalid";
  if (!Number.isFinite(openedAt) || !Number.isFinite(closedAt) || closedAt <= openedAt) {
    return "Trade dates are invalid";
  }
  if (!finitePositive(trade.entryPrice) || !finitePositive(trade.exitPrice)) {
    return "Trade prices are invalid";
  }
  if (!Number.isFinite(trade.resultR) || Math.abs(trade.resultR) > MAX_ABSOLUTE_R) {
    return "Trade R result is outside the publication safety range";
  }
  return null;
}
