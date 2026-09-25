import type { BybitExecution, BybitPosition } from "./bybit";

interface PriorPositionCycle {
  id: string;
  quantity: number;
  entryPrice: number;
  publicationHold?: boolean;
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
}): boolean {
  if (input.priorOpenCycles.some((cycle) => cycle.publicationHold || cycle.id !== input.cycleId)) {
    return true;
  }
  const prior = input.priorOpenCycles.find((cycle) => cycle.id === input.cycleId);
  if (prior) {
    const currentQuantity = amount(input.position.size);
    if (currentQuantity > prior.quantity && differs(currentQuantity, prior.quantity)) return true;
    if (differs(amount(input.position.avgPrice), prior.entryPrice)) return true;
  }
  return currentPositionOpeningOrderIds(input.position, input.executions).size > 1;
}

/** Detect an add that opened and closed between syncs, before the net position went flat. */
export function hasMultipleOpeningOrdersInCycle(input: {
  symbol: string;
  side: "Buy" | "Sell";
  openedAt: Date;
  closedAt: Date;
  executions: BybitExecution[];
}): boolean {
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
    if (orders.size > 1) return true;
    if (quantity <= TOLERANCE) break;
  }

  return false;
}
