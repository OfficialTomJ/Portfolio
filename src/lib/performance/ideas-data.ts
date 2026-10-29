import "server-only";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { getTagCatalogue, getTradeAnnotations } from "./annotations";
import { selectIdeaTrades, type IdeaCycleSource, type IdeaPnlSource } from "./ideas-selection";
import { IdeasRepository } from "./ideas-repository";
import { PERFORMANCE_COLLECTIONS } from "./sync";
import type { PerformanceTrade } from "./types";
import { publicTradeIdForCycle } from "./publication";

export async function getIdeasContext() {
  const db = getDb();
  const environment = process.env.BYBIT_ENV ?? "demo";
  const state = await db.collection<{ _id: string; lastRunId: string; lastSuccessAt: Date }>(PERFORMANCE_COLLECTIONS.syncState).findOne({ _id: environment });
  if (!state || !(state.lastSuccessAt instanceof Date)) return null;
  const run = await db.collection<{ _id: string; sourceAccountId?: string }>(PERFORMANCE_COLLECTIONS.syncRuns)
    .findOne({ _id: state.lastRunId, environment, status: "succeeded" }, { projection: { sourceAccountId: 1 } });
  if (!run?.sourceAccountId) return null;
  const scope = { environment, sourceAccountId: run.sourceAccountId };
  return { db, scope, lastSyncAt: state.lastSuccessAt.toISOString(), repository: new IdeasRepository(db, getMongoClient(), scope) };
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
  const trades = selectIdeaTrades(cycles, published, pnl);
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
  return { ...groups, trades, lastSyncAt: context.lastSyncAt, environment: context.scope.environment };
}
