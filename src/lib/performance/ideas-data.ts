import "server-only";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { getTagCatalogue, getTradeAnnotations } from "./annotations";
import { selectIdeaTrades, selectJournalIdeaTrades, type IdeaCycleSource, type IdeaPnlSource } from "./ideas-selection";
import { IdeasRepository } from "./ideas-repository";
import { PERFORMANCE_COLLECTIONS } from "./sync";
import type { PerformanceTrade } from "./types";
import { publicTradeIdForCycle } from "./publication";
import { readBreakoutAccount, storedBreakoutRows, storedLegacyScope } from "./journal";
import { BREAKOUT_ACCOUNT_ID } from "./breakout";

export async function getIdeasContext() {
  const db = getDb();
  const [legacy, account] = await Promise.all([storedLegacyScope(db), readBreakoutAccount(db)]);
  if (!legacy && !account) return null;
  // Keep the existing private ideas scope and assignments when legacy history exists.
  const scope = legacy ? { environment: legacy.environment, sourceAccountId: legacy.sourceAccountId } : { environment: "breakout", sourceAccountId: BREAKOUT_ACCOUNT_ID };
  return { db, scope, account, lastSyncAt: (account?.lastImportedAt ?? legacy!.state.lastSuccessAt).toISOString(), repository: new IdeasRepository(db, getMongoClient(), scope) };
}

export async function getIdeaHistory(context: NonNullable<Awaited<ReturnType<typeof getIdeasContext>>>) {
  const { db, scope } = context;
  const cycles = await db.collection<IdeaCycleSource>(PERFORMANCE_COLLECTIONS.positionCycles).find(scope, { projection: {
    symbol: 1, direction: 1, openedAt: 1, closedAt: 1, entryPrice: 1, quantity: 1,
    status: 1, excludedFromJournal: 1, publicationHold: 1, reviewCandidate: 1, reviewFingerprint: 1, riskAmount: 1,
  } }).toArray();
  const [published, pnl] = await Promise.all([
    db.collection<PerformanceTrade>(PERFORMANCE_COLLECTIONS.publishedTrades).find({ id: { $in: cycles.map(c => publicTradeIdForCycle(c._id)) } }, { projection: {
      _id: 0, id: 1, symbol: 1, direction: 1, openedAt: 1, closedAt: 1, entryPrice: 1, exitPrice: 1, resultR: 1,
    } }).toArray(),
    db.collection<IdeaPnlSource>(PERFORMANCE_COLLECTIONS.closedPnl).find(scope, { projection: { cycleId: 1, closedPnl: 1, execType: 1 } }).toArray(),
  ]);
  const imported = await storedBreakoutRows(db);
  if (imported.length > 20_000) throw new Error("Imported history requires an account review.");
  const trades = selectJournalIdeaTrades(selectIdeaTrades(cycles, published, pnl), imported, context.account);
  const [annotations, tags] = await Promise.all([getTradeAnnotations(trades.map(t => t.id)), getTagCatalogue()]);
  return trades.map(t => ({ ...t,
    tradeType: annotations[t.id]?.tradeType ?? null,
    strategies: (annotations[t.id]?.strategyIds ?? []).map(id => tags.find(tag => tag.id === id)?.name ?? "Unknown strategy"),
    privateNotes: annotations[t.id]?.privateNotes ?? "", asrComments: annotations[t.id]?.asrComments ?? "", description: annotations[t.id]?.description ?? "",
  }));
}

export async function getIdeasSnapshot() {
  const context = await getIdeasContext();
  if (!context) return null;
  const [trades, groups] = await Promise.all([getIdeaHistory(context), context.repository.load()]);
  return { ...groups, trades, lastSyncAt: context.lastSyncAt, environment: context.account ? "breakout" : context.scope.environment };
}
