import { validatePublishedPerformanceTrade } from "./sync-validation";
import type { PerformanceDataset, PerformanceTrade, TradeDirection } from "./types";

export interface ReviewCycleCandidate {
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
