import { normalizeClosedCycle, type ClosedPnlSlice } from "./normalize";
import { publicTradeIdForCycle } from "./publication";
import { validatePublishedPerformanceTrade } from "./sync-validation";
import type { PerformanceTrade, TradeDirection } from "./types";

export interface AdminReadOnlyClosedTrade { id: string; reason: "exception" | "reconciliation" }
export interface PrivateClosedLedgerCycle {
  _id: string; symbol: string; direction: TradeDirection; status: string;
  openedAt: Date; entryPrice: number; riskAmount?: number;
  executionClosedAt?: Date; closedAt?: Date; excludedFromJournal?: boolean; publicationHold?: boolean;
  reconstructedCycleAliasOf?: string;
}

/** Private actual PnL can include exceptions and held closes without granting publication. */
export function assemblePrivateClosedLedger(
  cycles: PrivateClosedLedgerCycle[],
  slices: Array<ClosedPnlSlice & { cycleId?: string }>,
  existingTrades: PerformanceTrade[]
): { trades: PerformanceTrade[]; readOnlyClosedTrades: AdminReadOnlyClosedTrade[] } {
  const existingIds = new Set(existingTrades.map(trade => trade.id));
  const trades: PerformanceTrade[] = [];
  const readOnlyClosedTrades: AdminReadOnlyClosedTrade[] = [];
  for (const cycle of cycles) {
    if (cycle.reconstructedCycleAliasOf || cycle.status === "open" || (!cycle.excludedFromJournal && !cycle.publicationHold)) continue;
    const end = cycle.executionClosedAt ?? cycle.closedAt;
    if (!end || !Number.isFinite(end.getTime())) continue;
    const id = publicTradeIdForCycle(cycle._id);
    if (existingIds.has(id)) continue;
    // Bybit's PnL receipt time may trail the matching final execution by milliseconds.
    const endMs = Math.max(end.getTime(), cycle.closedAt?.getTime() ?? end.getTime());
    const records = slices.filter(slice => slice.cycleId === cycle._id && Number(slice.updatedTime) <= endMs);
    const result = normalizeClosedCycle({ id, symbol: cycle.symbol, direction: cycle.direction,
      openedAt: cycle.openedAt, fallbackEntryPrice: cycle.entryPrice, riskAmount: cycle.riskAmount }, records);
    if (!result.ok || validatePublishedPerformanceTrade(result.trade)) continue;
    existingIds.add(id);
    trades.push(result.trade);
    readOnlyClosedTrades.push({ id, reason: cycle.excludedFromJournal ? "exception" : "reconciliation" });
  }
  return { trades, readOnlyClosedTrades };
}
