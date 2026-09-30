import type { BybitExecution, BybitPosition } from "./bybit";

interface PriorPositionCycle {
  id: string;
  quantity: number;
  entryPrice: number;
  publicationHold?: boolean;
}

export interface SameTradeEntryAttribution {
  openingOrderIds: string[];
  stopPrice: number;
  confirmedAt: Date;
  invalidatedAt?: Date;
}

const TOLERANCE = 1e-6;

function amount(value: string | number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function differs(left: number, right: number): boolean {
  return Math.abs(left - right) > TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right));
}

function openingQuantity(execution: BybitExecution): number {
  return Math.max(0, amount(execution.execQty) - amount(execution.closedSize));
}

export function matchesAttributedOpeningOrders(actual: Set<string>, expected?: string[]): boolean {
  if (!expected || expected.length < 2 || actual.size !== expected.length) return false;
  const uniqueExpected = new Set(expected);
  return uniqueExpected.size === expected.length && expected.every((id) => actual.has(id));
}

/** Rewind the net position to identify distinct orders that opened its current exposure. */
export function currentPositionOpeningOrderIds(
  position: BybitPosition,
  executions: BybitExecution[]
): Set<string> {
  const orders = new Set<string>();
  const entries = executions
    .filter((execution) => execution.symbol === position.symbol && execution.execType === "Trade")
    .sort((a, b) => amount(b.execTime) - amount(a.execTime) || b.seq - a.seq);
  let quantityBefore = amount(position.size);

  for (const execution of entries) {
    const quantity = amount(execution.execQty);
    const sameSide = execution.side === position.side;
    if (sameSide && openingQuantity(execution) > TOLERANCE) orders.add(execution.orderId);
    const previousQuantity = quantityBefore + (sameSide ? -quantity : quantity);
    if (previousQuantity <= TOLERANCE) break;
    quantityBefore = previousQuantity;
  }

  return orders;
}

/** Conservative: a position increase, changed basis, or distinct entry order needs attribution. */
export function hasOverlappingPositionEntries(input: {
  cycleId: string;
  position: BybitPosition;
  priorOpenCycles: PriorPositionCycle[];
  executions: BybitExecution[];
  sameTradeAttribution?: SameTradeEntryAttribution;
}): boolean {
  if (input.priorOpenCycles.some((cycle) => cycle.id !== input.cycleId)) return true;
  const prior = input.priorOpenCycles.find((cycle) => cycle.id === input.cycleId);
  const openingOrders = currentPositionOpeningOrderIds(input.position, input.executions);
  const attribution = input.sameTradeAttribution;
  const attributed = !!prior && !!attribution && !attribution.invalidatedAt &&
    !differs(amount(input.position.stopLoss), attribution.stopPrice) &&
    matchesAttributedOpeningOrders(openingOrders, attribution.openingOrderIds);
  if (attributed) return false;
  if (prior?.publicationHold) return true;
  if (prior) {
    const currentQuantity = amount(input.position.size);
    if (currentQuantity > prior.quantity && differs(currentQuantity, prior.quantity)) return true;
    if (differs(amount(input.position.avgPrice), prior.entryPrice)) return true;
  }
  return openingOrders.size > 1;
}

/** The distinct orders that opened one continuous position, stopping when it went flat. */
export function openingOrderIdsInCycle(input: {
  symbol: string;
  side: "Buy" | "Sell";
  openedAt: Date;
  closedAt: Date;
  executions: BybitExecution[];
}): Set<string> {
  const orders = new Set<string>();
  const start = input.openedAt.getTime() - 1000;
  const end = input.closedAt.getTime() + 1000;
  const entries = input.executions
    .filter((execution) =>
      execution.symbol === input.symbol &&
      execution.execType === "Trade" &&
      amount(execution.execTime) >= start &&
      amount(execution.execTime) <= end
    )
    .sort((a, b) => amount(a.execTime) - amount(b.execTime) || a.seq - b.seq);
  let quantity = 0;
  let started = false;

  for (const execution of entries) {
    const sameSide = execution.side === input.side;
    if (!started && !sameSide) continue;
    started = true;
    if (sameSide) {
      quantity += amount(execution.execQty);
      if (openingQuantity(execution) > TOLERANCE) orders.add(execution.orderId);
    } else {
      quantity -= amount(execution.execQty);
    }
    if (quantity <= TOLERANCE) break;
  }

  return orders;
}

/** Detect an unattributed add, including one opened and closed between syncs. */
export function hasMultipleOpeningOrdersInCycle(input: {
  symbol: string;
  side: "Buy" | "Sell";
  openedAt: Date;
  closedAt: Date;
  executions: BybitExecution[];
  attributedOpeningOrderIds?: string[];
}): boolean {
  const orders = openingOrderIdsInCycle(input);
  return orders.size > 1 && !matchesAttributedOpeningOrders(orders, input.attributedOpeningOrderIds);
}
