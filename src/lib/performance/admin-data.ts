import "server-only";
import { getDb } from "@/lib/mongodb";
import { assembleReconciliation, type AdminReconciliationItem, type AdminActivePosition, type AdminPendingReview } from "./admin-selection";
import { getLivePerformanceDataset, getLivePerformanceTrade, toPublicTrade } from "./data";
import { getTagCatalogue, getTradeAnnotations } from "./annotations";
import { enrichPublicTrades } from "./public-metadata";
import { isLegacyHistory } from "./breakout";
import { storedLegacyScope, storedBreakoutRows, readBreakoutAccount, type StoredLegacyCycle } from "./journal";
import type { PerformanceDataset, PerformanceTrade, TradeTag } from "./types";
import type { TradeAnnotation } from "./annotations-model";
export type { AdminActivePosition } from "./admin-selection";

export interface AdminPerformanceSnapshot {
  dataset: PerformanceDataset; pendingReviews: AdminPendingReview[]; activePositions: AdminActivePosition[];
  reconciliation: AdminReconciliationItem[]; lastSyncAt: string; annotations: Record<string, TradeAnnotation>; tags: TradeTag[];
  bybitHistory: PerformanceTrade[];
}

export async function getAdminPerformanceSnapshot(): Promise<AdminPerformanceSnapshot | null> {
  const db = getDb();
  const [scope, account, imported, publicResult, published] = await Promise.all([
    storedLegacyScope(db), readBreakoutAccount(db), storedBreakoutRows(db), getLivePerformanceDataset(),
    db.collection<PerformanceTrade & { _id: string }>("performance_published_trades").find({ source: { $ne: "breakout" } }).toArray(),
  ]);
  const cycles = scope ? await db.collection<StoredLegacyCycle>("performance_private_position_cycles").find({ environment: scope.environment, sourceAccountId: scope.sourceAccountId }).toArray() : [];
  const lastAt = account?.lastImportedAt ?? scope?.state.lastSuccessAt ?? new Date();
  const publicDataset: PerformanceDataset = publicResult.status === "available" ? publicResult.dataset : {
    id: "admin-review", label: "Private review", description: "No imports yet", inceptionAt: (scope?.state.firstSyncAt ?? lastAt).toISOString(), asOf: lastAt.toISOString(), trades: [],
  };
  const visiblePublished = publicDataset.trades.filter(trade => trade.source === "breakout" || isLegacyHistory(trade, account));
  const publishedIds = new Set(visiblePublished.map(trade => trade.id));
  const legacyPublishedIds = new Set(published.map(trade => trade.id));
  const pendingCycles = cycles.filter(cycle => cycle.status === "pending_review" && !cycle.publicationHold && !cycle.excludedFromJournal &&
    cycle.reviewCandidate && !publishedIds.has(cycle.reviewCandidate.id) && isLegacyHistory(cycle.reviewCandidate, account) &&
    typeof cycle.reviewFingerprint === "string" && /^[a-f0-9]{64}$/.test(cycle.reviewFingerprint));
  const legacyPending = pendingCycles.map(cycle => toPublicTrade(cycle.reviewCandidate!)).filter((trade): trade is PerformanceTrade => !!trade);
  const clean = imported.filter(row => row.status === "pending_review");
  const trades = await enrichPublicTrades([...visiblePublished, ...legacyPending, ...clean.map(row => row.trade)]);
  const bybitHistory = [...new Map([...published.map(toPublicTrade).filter((trade): trade is PerformanceTrade => !!trade),
    ...cycles.filter(cycle => cycle.status === "pending_review" && !cycle.excludedFromJournal && cycle.reviewCandidate && !legacyPublishedIds.has(cycle.reviewCandidate.id)).map(cycle => toPublicTrade(cycle.reviewCandidate!)).filter((trade): trade is PerformanceTrade => !!trade)]
    .map(trade => [trade.id, trade])).values()].sort((a, b) => b.closedAt.localeCompare(a.closedAt));
  const ids = [...new Set([...trades, ...bybitHistory].map(trade => trade.id))];
  const [annotations, tags] = await Promise.all([getTradeAnnotations(ids), getTagCatalogue()]);
  const reconciliation = [
    ...imported.filter(row => row.status === "reconciliation").map(row => ({ id: row.trade.id, source: row.trade.source, symbol: row.trade.symbol,
      direction: row.trade.direction, openedAt: row.trade.openedAt, closedAt: row.trade.closedAt, lastSeenAt: row.importedAt.toISOString(), reason: row.reason ?? "Agent reconciliation required" })),
    ...assembleReconciliation(cycles.filter(cycle => !account || (cycle.reviewCandidate && isLegacyHistory(cycle.reviewCandidate, account)))),
  ];
  return { dataset: { ...publicDataset, id: "admin-review", asOf: lastAt.toISOString(), trades },
    pendingReviews: [...pendingCycles.map(cycle => ({ id: cycle.reviewCandidate!.id, fingerprint: cycle.reviewFingerprint! })),
      ...clean.map(row => ({ id: row.trade.id, fingerprint: row.fingerprint, riskConfirmed: row.riskConfirmed }))],
    activePositions: [], reconciliation, lastSyncAt: lastAt.toISOString(), annotations, tags, bybitHistory };
}

export async function getAdminPerformanceTrade(id: string): Promise<{ trade: PerformanceTrade; status: "published" | "pending_review"; fingerprint?: string } | null> {
  if (!/^trade-[a-f0-9]{20}$/.test(id)) return null;
  const pub = await getLivePerformanceTrade(id);
  if (pub.status === "available") return { trade: pub.trade, status: "published" };
  const snapshot = await getAdminPerformanceSnapshot();
  const pending = snapshot?.pendingReviews.find(item => item.id === id);
  const trade = snapshot?.dataset.trades.find(item => item.id === id);
  return pending && trade ? { trade, status: "pending_review", fingerprint: pending.fingerprint } : null;
}
