import { validatePublishedPerformanceTrade } from "./sync-validation";
import type { PerformanceDataset, PerformanceTrade, TradeDirection } from "./types";
import { publicTradeIdForCycle } from "./publication";

export interface ReviewCycleCandidate {
  _id?: string;
  status: "open" | "pending_review" | "excluded";
  symbol: string;
  direction: TradeDirection;
  openedAt: Date;
  lastSeenAt: Date;
  entryPrice: number;
  publicationHold?: boolean;
  excludedFromJournal?: boolean;
  reviewFingerprint?: string;
  reviewCandidate?: PerformanceTrade;
}

export interface AdminActivePosition {
  id: string;
  symbol: string;
  direction: TradeDirection;
  openedAt: string;
  entryPrice: number;
  lastSeenAt: string;
}

export interface AdminPendingReview {
  id: string;
  fingerprint: string;
}

export interface AdminReconciliationItem {
  id: string;
  symbol: string;
  direction: TradeDirection;
  openedAt: string;
  closedAt?: string;
  lastSeenAt: string;
  reason: string;
}

/** Private, read-only summaries only. Never add unresolved records to the results dataset. */
export function assembleReconciliation(cycles: Array<{
  _id: string; symbol: string; direction: TradeDirection; openedAt: Date;
  closedAt?: Date; lastSeenAt: Date; status: string;
  publicationHold?: boolean; excludedFromJournal?: boolean;
}>): AdminReconciliationItem[] {
  return cycles.filter(cycle => !cycle.excludedFromJournal && (
    cycle.publicationHold || ["awaiting_attribution", "awaiting_close", "unresolved"].includes(cycle.status)
  )).filter(cycle => cycle.openedAt instanceof Date && Number.isFinite(cycle.openedAt.getTime()) &&
    cycle.lastSeenAt instanceof Date && Number.isFinite(cycle.lastSeenAt.getTime()))
    .map(cycle => ({
      id: publicTradeIdForCycle(cycle._id), symbol: cycle.symbol, direction: cycle.direction,
      openedAt: cycle.openedAt.toISOString(), lastSeenAt: cycle.lastSeenAt.toISOString(),
      ...(cycle.closedAt instanceof Date && Number.isFinite(cycle.closedAt.getTime()) ? { closedAt: cycle.closedAt.toISOString() } : {}),
      reason: cycle.publicationHold || cycle.status === "awaiting_attribution"
        ? "Entry attribution required" : cycle.status === "awaiting_close"
          ? "Waiting for recorded closing data" : "Risk or closing data needs reconciliation",
    })).sort((a, b) => Date.parse(b.closedAt ?? b.openedAt) - Date.parse(a.closedAt ?? a.openedAt) || a.id.localeCompare(b.id));
}

export function assembleAdminReview(
  publicDataset: PerformanceDataset,
  pendingCycles: ReviewCycleCandidate[],
  activeCycles: ReviewCycleCandidate[],
  lastSyncAt: Date
) {
  const publishedIds = new Set(publicDataset.trades.map((trade) => trade.id));
  const pending = pendingCycles
    .filter((cycle) => cycle.status === "pending_review" && !cycle.publicationHold && !cycle.excludedFromJournal)
    .filter((cycle) => typeof cycle.reviewFingerprint === "string" && /^[a-f0-9]{64}$/.test(cycle.reviewFingerprint))
    .filter((cycle) => !!cycle.reviewCandidate && !validatePublishedPerformanceTrade(cycle.reviewCandidate))
    .filter((cycle) => !publishedIds.has(cycle.reviewCandidate!.id));
  const activePositions = activeCycles
    .filter((cycle) => (cycle.status === "open" || cycle.status === "excluded") && cycle.lastSeenAt instanceof Date && cycle.lastSeenAt.getTime() === lastSyncAt.getTime())
    .filter((cycle) => cycle.openedAt instanceof Date && Number.isFinite(cycle.entryPrice) && cycle.entryPrice > 0)
    .map((cycle) => ({
      id: publicTradeIdForCycle(cycle._id ?? `${cycle.symbol}:${cycle.openedAt.toISOString()}`),
      symbol: cycle.symbol,
      direction: cycle.direction,
      openedAt: cycle.openedAt.toISOString(),
      entryPrice: cycle.entryPrice,
      lastSeenAt: cycle.lastSeenAt.toISOString(),
    }))
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));

  return {
    dataset: {
      ...publicDataset,
      id: "admin-review",
      label: "Private review",
      description: "Published and pending-review closed trades",
      trades: [...publicDataset.trades, ...pending.map((cycle) => cycle.reviewCandidate!)],
    },
    pendingReviews: pending.map((cycle) => ({
      id: cycle.reviewCandidate!.id,
      fingerprint: cycle.reviewFingerprint!,
    })),
    activePositions,
    lastSyncAt: lastSyncAt.toISOString(),
  };
}
