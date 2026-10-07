import type { BybitExecution } from "./bybit";
import type { TradeDirection } from "./types";

export interface ClosedExecutionCycle {
  symbol: string;
  positionIdx: number;
  direction: TradeDirection;
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  quantity: number;
  openingOrderIds: string[];
  closingOrderIds: string[];
}

interface RunningCycle {
  symbol: string; positionIdx: number; direction: TradeDirection;
  openedAt: Date; quantity: number; entryQuantity: number; entryValue: number;
  openingOrderIds: Set<string>; closingOrderIds: Set<string>;
}
const EPSILON = 1e-9;

/** Recover only fully evidenced flat-to-flat positions, never from PnL dates alone. */
export function reconstructClosedExecutionCycles(
  executions: BybitExecution[],
  orderPositionIndices: Map<string, number>
): ClosedExecutionCycle[] {
  const unique = new Map<string, BybitExecution>();
  for (const fill of executions.filter(e => e.execType === "Trade")) {
    const previous = unique.get(fill.execId);
    if (previous && ["orderId", "symbol", "side", "execQty", "closedSize", "execTime", "execPrice"].some(key => previous[key as keyof BybitExecution] !== fill[key as keyof BybitExecution])) {
      throw new Error("Conflicting execution records require reconciliation");
    }
    unique.set(fill.execId, fill);
  }
  const streams = new Map<string, RunningCycle>();
  const closed: ClosedExecutionCycle[] = [];
  for (const fill of [...unique.values()].sort((a, b) => Number(a.execTime) - Number(b.execTime) || a.seq - b.seq || a.execId.localeCompare(b.execId))) {
    const index = orderPositionIndices.get(fill.orderId);
    if (index === undefined || ![0, 1, 2].includes(index)) {
      // An unknown order can invalidate the current boundary for this symbol.
      for (const [key, cycle] of streams) if (cycle.symbol === fill.symbol) streams.delete(key);
      continue;
    }
    const key = `${fill.symbol}:${index}`;
    const quantity = Number(fill.execQty), closing = Number(fill.closedSize), price = Number(fill.execPrice), time = Number(fill.execTime);
    if (![quantity, closing, price, time].every(Number.isFinite) || quantity <= 0 || closing < 0 || closing > quantity + EPSILON || price <= 0 || time <= 0) {
      streams.delete(key);
      continue;
    }
    let cycle = streams.get(key);
    const direction: TradeDirection = fill.side === "Buy" ? "Long" : "Short";
    if (closing > EPSILON) {
      if (!cycle || cycle.direction === direction || closing > cycle.quantity + EPSILON) {
        // History begins mid-position or contains a gap. Do not invent its entry.
        streams.delete(key);
        cycle = undefined;
      } else {
        cycle.quantity -= closing;
        cycle.closingOrderIds.add(fill.orderId);
        if (cycle.quantity <= EPSILON) {
          closed.push({ symbol: cycle.symbol, positionIdx: index, direction: cycle.direction,
            openedAt: cycle.openedAt, closedAt: new Date(time),
            entryPrice: cycle.entryValue / cycle.entryQuantity, quantity: cycle.entryQuantity,
            openingOrderIds: [...cycle.openingOrderIds].sort(), closingOrderIds: [...cycle.closingOrderIds].sort() });
          streams.delete(key);
          cycle = undefined;
        }
      }
    }
    const opening = quantity - closing;
    if (opening <= EPSILON) continue;
    if (cycle && cycle.direction !== direction) {
      streams.delete(key);
      continue;
    }
    if (!cycle) {
      cycle = { symbol: fill.symbol, positionIdx: index, direction, openedAt: new Date(time), quantity: 0,
        entryQuantity: 0, entryValue: 0, openingOrderIds: new Set(), closingOrderIds: new Set() };
      streams.set(key, cycle);
    }
    cycle.quantity += opening;
    cycle.entryQuantity += opening;
    cycle.entryValue += opening * price;
    cycle.openingOrderIds.add(fill.orderId);
  }
  const owners = new Map<string, ClosedExecutionCycle>();
  for (const cycle of closed) for (const orderId of cycle.closingOrderIds) {
    if (owners.has(orderId)) throw new Error("A closing order spans multiple positions and requires reconciliation");
    owners.set(orderId, cycle);
  }
  return closed;
}

/** A legacy fallback must never extend a known closed trade into a later trade. */
export function isWithinCycleBoundary(cycle: { openedAt: Date; closedAt?: Date; executionClosedAt?: Date }, closedAt: Date): boolean {
  const end = cycle.executionClosedAt ?? cycle.closedAt;
  return cycle.openedAt.getTime() <= closedAt.getTime() && (!end || closedAt.getTime() <= end.getTime());
}

/** Match timestamp drift only to the nearest real flat boundary, preserving older IDs. */
export function matchExistingExecutionCycle<T extends {
  _id: string; symbol: string; direction: TradeDirection; positionIdx: number;
  openedAt: Date; firstSeenAt: Date; reconstructedCycleAliasOf?: string;
}>(boundary: ClosedExecutionCycle, boundaries: ClosedExecutionCycle[], existing: T[]): T | undefined {
  const stream = boundaries.filter(item => item.symbol === boundary.symbol && item.direction === boundary.direction && item.positionIdx === boundary.positionIdx);
  return existing.filter(cycle => {
    if (cycle.reconstructedCycleAliasOf || cycle.symbol !== boundary.symbol || cycle.direction !== boundary.direction || cycle.positionIdx !== boundary.positionIdx) return false;
    const distance = Math.abs(cycle.openedAt.getTime() - boundary.openedAt.getTime());
    return distance <= 1000 && stream.every(item => item === boundary || Math.abs(cycle.openedAt.getTime() - item.openedAt.getTime()) > distance);
  }).sort((a, b) => a.firstSeenAt.getTime() - b.firstSeenAt.getTime() || a._id.localeCompare(b._id))[0];
}
