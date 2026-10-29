import type { Db, MongoClient } from "mongodb";
import { BREAKOUT_ACCOUNT_ID, breakoutConflicts, breakoutFingerprint, isLegacyHistory, type BreakoutAccount, type BreakoutRecord } from "./breakout";
import { BREAKOUT_COLLECTIONS, BreakoutConflictError, readBreakoutAccount } from "./breakout-store";
import { performanceReviewFingerprint } from "./review";
import { publicTradeIdForCycle } from "./publication";
import { normalizeClosedCycle } from "./normalize";
import { validatePublishedPerformanceTrade } from "./sync-validation";
import type { BybitClosedPnl } from "./bybit";
import type { PerformanceTrade } from "./types";

export interface StoredLegacyCycle {
  _id: string; environment: string; sourceAccountId: string; symbol: string;
  direction: "Long" | "Short"; openedAt: Date; closedAt?: Date; lastSeenAt: Date;
  entryPrice: number; status: "pending_review" | "published" | "open" | "excluded" | "awaiting_attribution" | "awaiting_close" | "unresolved";
  publicationHold?: boolean; excludedFromJournal?: boolean; reviewCandidate?: PerformanceTrade;
  reviewFingerprint?: string; riskAmount?: number; riskVersionId?: string;
}
export async function storedLegacyScope(db: Db) {
  const environment = process.env.BYBIT_ENV ?? "demo";
  const state = await db.collection<{ _id: string; lastRunId: string; lastSuccessAt: Date; firstSyncAt: Date }>("performance_private_sync_state").findOne({ _id: environment });
  const run = state && await db.collection<{ _id: string; sourceAccountId: string; status: string }>("performance_private_sync_runs").findOne({ _id: state.lastRunId, status: "succeeded", environment });
  return state && run?.sourceAccountId ? { environment, sourceAccountId: run.sourceAccountId, state } : null;
}

export async function activateBreakoutSource(db: Db, client: MongoClient, revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new BreakoutConflictError("Refresh the import history before switching sources.");
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const account = await db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).findOne({ _id: BREAKOUT_ACCOUNT_ID }, { session });
      if (!account || account.importRevision !== revision) throw new BreakoutConflictError("The imported history changed. Refresh before switching sources.");
      await db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).updateOne({ _id: BREAKOUT_ACCOUNT_ID, importRevision: revision },
        { $set: { activatedAt: new Date(), activatedFrom: account.historyFrom }, $inc: { importRevision: 1 } }, { session });
    }, { timeoutMS: 30_000, maxCommitTimeMS: 10_000 });
  } finally { await session.endSession(); }
}

/** Publishes stored reviewed facts only. Never refreshes an exchange or guesses a migration mapping. */
export async function publishStoredTrade(db: Db, client: MongoClient, id: string, fingerprint: string): Promise<void> {
  const scope = await storedLegacyScope(db);
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const rows = db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows);
      const row = await rows.findOne({ _id: id, accountId: BREAKOUT_ACCOUNT_ID }, { session });
      const account = await db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).findOne({ _id: BREAKOUT_ACCOUNT_ID }, { session });
      let trade: PerformanceTrade;
      if (row) {
        if (!account?.activatedAt) throw new BreakoutConflictError("Confirm the Breakout source switch before publishing.");
        if (row.trade.openedAt < (account.activatedFrom ?? account.historyFrom)) throw new BreakoutConflictError("Confirm the Breakout source switch for the earlier imported history before publishing.");
        if (row.status !== "pending_review" || !row.riskConfirmed || row.fingerprint !== fingerprint || breakoutFingerprint(row) !== fingerprint || validatePublishedPerformanceTrade(row.trade)) throw new BreakoutConflictError("Trade changed, needs risk confirmation, or requires reconciliation.");
        const all = await rows.find({ accountId: BREAKOUT_ACCOUNT_ID }, { session }).limit(20_001).toArray();
        if (all.length > 20_000 || breakoutConflicts(all).has(row.key) || all.some(other => other.identity === row.identity && other.key !== row.key)) throw new BreakoutConflictError("This position needs agent reconciliation.");
        // Serialize with imports, which also revise the account document.
        await db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).updateOne({ _id: BREAKOUT_ACCOUNT_ID }, { $inc: { importRevision: 1 } }, { session });
        trade = row.trade;
        await rows.updateOne({ _id: id, status: "pending_review", fingerprint }, { $set: { status: "published" } }, { session });
      } else {
        if (!scope) throw new BreakoutConflictError("Stored history is unavailable.");
        const cycles = db.collection<StoredLegacyCycle>("performance_private_position_cycles");
        const candidates = await cycles.find({ environment: scope.environment, sourceAccountId: scope.sourceAccountId, status: "pending_review", "reviewCandidate.id": id }, { session }).toArray();
        const cycle = candidates.find(candidate => publicTradeIdForCycle(candidate._id) === id);
        if (!cycle || cycle.publicationHold || cycle.excludedFromJournal || !cycle.reviewCandidate || cycle.reviewFingerprint !== fingerprint ||
          (account && !isLegacyHistory(cycle.reviewCandidate, account))) throw new BreakoutConflictError("This legacy result is changed, held, or covered by Breakout history.");
        const records = await db.collection<BybitClosedPnl & { cycleId: string }>("performance_private_closed_pnl").find({ cycleId: cycle._id, sourceAccountId: scope.sourceAccountId, environment: scope.environment, execType: "Trade" }, { session }).toArray();
        const normalized = normalizeClosedCycle({ id, symbol: cycle.symbol, direction: cycle.direction, openedAt: cycle.openedAt, fallbackEntryPrice: cycle.entryPrice, riskAmount: cycle.riskAmount }, records);
        if (!normalized.ok || validatePublishedPerformanceTrade(normalized.trade) || performanceReviewFingerprint(normalized.trade, records, cycle.riskVersionId, cycle.riskAmount) !== fingerprint) throw new BreakoutConflictError("Stored legacy evidence no longer matches the reviewed trade.");
        trade = normalized.trade;
        if (account) await db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).updateOne({ _id: BREAKOUT_ACCOUNT_ID }, { $inc: { importRevision: 1 } }, { session });
        await cycles.updateOne({ _id: cycle._id, status: "pending_review", reviewFingerprint: fingerprint },
          { $set: { status: "published", publishedTradeId: id, reviewApprovedFingerprint: fingerprint, reviewApprovedAt: new Date() } }, { session });
      }
      const now = new Date();
      await db.collection<PerformanceTrade & { _id: string; source: string; publishedAt: Date; updatedAt: Date }>("performance_published_trades").insertOne({ _id: id, ...trade, source: row ? "breakout" : "bybit", publishedAt: now, updatedAt: now }, { session });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, timeoutMS: 30_000, maxCommitTimeMS: 10_000 });
  } finally { await session.endSession(); }
}

export async function storedBreakoutRows(db: Db) {
  return db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows).find({ accountId: BREAKOUT_ACCOUNT_ID }).sort({ "trade.closedAt": -1 }).limit(20_001).toArray();
}
export { readBreakoutAccount };
