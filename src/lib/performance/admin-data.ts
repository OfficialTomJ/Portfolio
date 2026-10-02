import "server-only";

import { getDb } from "@/lib/mongodb";
import { assembleAdminReview, assembleReconciliation, type AdminReconciliationItem, type AdminActivePosition, type AdminPendingReview, type ReviewCycleCandidate } from "./admin-selection";
import { getLivePerformanceDataset, getLivePerformanceTrade } from "./data";
import { PERFORMANCE_COLLECTIONS } from "./sync";
import { validatePublishedPerformanceTrade } from "./sync-validation";
import type { PerformanceDataset, PerformanceTrade } from "./types";
import type { TradeTag } from "./types";
import type { TradeAnnotation } from "./annotations-model";
import { getTagCatalogue, getTradeAnnotations } from "./annotations";
import { enrichPublicTrades } from "./public-metadata";
export type { AdminActivePosition } from "./admin-selection";

interface SyncStateView {
  _id: string;
  lastRunId: string;
  lastSuccessAt: Date;
}

interface SyncRunView {
  _id: string;
  status: string;
  environment: string;
  sourceAccountId?: string;
}

interface ReviewCycleView extends ReviewCycleCandidate {
  _id: string;
  environment: string;
  sourceAccountId: string;
  closedAt?: Date;
}

interface ReconciliationCycleView extends Omit<ReviewCycleView, "status"> {
  status: string;
}

export interface AdminPerformanceSnapshot {
  dataset: PerformanceDataset;
  pendingReviews: AdminPendingReview[];
  activePositions: AdminActivePosition[];
  reconciliation: AdminReconciliationItem[];
  lastSyncAt: string;
  annotations: Record<string, TradeAnnotation>;
  tags: TradeTag[];
}

async function getCurrentAccountScope() {
  const db = getDb();
  const environment = process.env.BYBIT_ENV ?? "demo";
  const state = await db.collection<SyncStateView>(PERFORMANCE_COLLECTIONS.syncState)
    .findOne({ _id: environment });
  if (!state?.lastRunId || !(state.lastSuccessAt instanceof Date)) return null;
  const run = await db.collection<SyncRunView>(PERFORMANCE_COLLECTIONS.syncRuns)
    .findOne(
      { _id: state.lastRunId, status: "succeeded", environment },
      { projection: { sourceAccountId: 1, environment: 1, status: 1 } }
    );
  if (!run?.sourceAccountId) return null;
  return { environment, sourceAccountId: run.sourceAccountId, lastSyncAt: state.lastSuccessAt };
}

function validCandidate(cycle: Pick<ReviewCycleCandidate, "reviewCandidate" | "reviewFingerprint">): PerformanceTrade | null {
  const trade = cycle.reviewCandidate;
  return trade && typeof cycle.reviewFingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(cycle.reviewFingerprint) &&
    !validatePublishedPerformanceTrade(trade) ? trade : null;
}

export async function getAdminPerformanceSnapshot(): Promise<AdminPerformanceSnapshot | null> {
  const scope = await getCurrentAccountScope();
  if (!scope) return null;
  const publicResult = await getLivePerformanceDataset();
  if (publicResult.status !== "available") return null;

  const cycles = getDb().collection<ReviewCycleView>(PERFORMANCE_COLLECTIONS.positionCycles);
  const [pendingCycles, openCycles, reconciliationCycles] = await Promise.all([
    cycles.find({
      environment: scope.environment,
      sourceAccountId: scope.sourceAccountId,
      status: "pending_review",
      publicationHold: { $ne: true },
      excludedFromJournal: { $ne: true },
    }, { projection: {
      status: 1, symbol: 1, direction: 1, openedAt: 1, lastSeenAt: 1,
      entryPrice: 1, publicationHold: 1, excludedFromJournal: 1,
      reviewFingerprint: 1, reviewCandidate: 1,
    } }).toArray(),
    cycles.find({
      environment: scope.environment,
      sourceAccountId: scope.sourceAccountId,
      status: { $in: ["open", "excluded"] },
      lastSeenAt: scope.lastSyncAt,
    }, { projection: {
      status: 1, symbol: 1, direction: 1, openedAt: 1, lastSeenAt: 1,
      entryPrice: 1, publicationHold: 1, excludedFromJournal: 1,
    } }).toArray(),
    getDb().collection<ReconciliationCycleView>(PERFORMANCE_COLLECTIONS.positionCycles).find({
      environment: scope.environment,
      sourceAccountId: scope.sourceAccountId,
      excludedFromJournal: { $ne: true },
      $or: [{ publicationHold: true }, { status: { $in: ["awaiting_attribution", "awaiting_close", "unresolved"] } }],
    }, { projection: { symbol: 1, direction: 1, openedAt: 1, closedAt: 1, lastSeenAt: 1,
      status: 1, publicationHold: 1, excludedFromJournal: 1 } }).toArray(),
  ]);

  const snapshot = assembleAdminReview(publicResult.dataset, pendingCycles, openCycles, scope.lastSyncAt);
  const [annotations, tags, trades] = await Promise.all([
    getTradeAnnotations([...snapshot.dataset.trades.map((trade) => trade.id), ...snapshot.activePositions.map((trade) => trade.id)]),
    getTagCatalogue(), enrichPublicTrades(snapshot.dataset.trades),
  ]);
  return { ...snapshot, reconciliation: assembleReconciliation(reconciliationCycles), dataset: { ...snapshot.dataset, trades }, annotations, tags };
}

export async function getAdminPerformanceTrade(id: string): Promise<{
  trade: PerformanceTrade;
  status: "published" | "pending_review";
  fingerprint?: string;
} | null> {
  if (!/^trade-[a-f0-9]+$/.test(id)) return null;
  const publicResult = await getLivePerformanceTrade(id);
  if (publicResult.status === "available") return { trade: publicResult.trade, status: "published" };

  const scope = await getCurrentAccountScope();
  if (!scope) return null;
  const cycle = await getDb().collection<ReviewCycleView>(PERFORMANCE_COLLECTIONS.positionCycles)
    .findOne({
      environment: scope.environment,
      sourceAccountId: scope.sourceAccountId,
      status: "pending_review",
      "reviewCandidate.id": id,
      publicationHold: { $ne: true },
      excludedFromJournal: { $ne: true },
    }, { projection: { reviewCandidate: 1, reviewFingerprint: 1, status: 1 } });
  const trade = cycle && validCandidate(cycle);
  return trade ? { trade: (await enrichPublicTrades([trade]))[0], status: "pending_review", fingerprint: cycle!.reviewFingerprint } : null;
}
