import "server-only";
import { getDb } from "@/lib/mongodb";
import { PERFORMANCE_COLLECTIONS, type PublishedPerformanceTrade } from "./sync";
import { excludedTradeIds } from "./publication";
import { enrichPublicTrades } from "./public-metadata";
import { validatePublishedPerformanceTrade } from "./sync-validation";
import { activeBreakoutHistoryFrom, isLegacyHistory } from "./breakout";
import { readBreakoutAccount } from "./breakout-store";
import type { PerformanceDatasetLoadResult, PerformanceTrade, PerformanceTradeLoadResult } from "./types";

const PUBLIC_TRADE_PROJECTION = { _id: 1, id: 1, symbol: 1, direction: 1, openedAt: 1, closedAt: 1,
  resultR: 1, entryPrice: 1, exitPrice: 1, source: 1, updatedAt: 1 } as const;

export function toPublicTrade(document: PerformanceTrade): PerformanceTrade | null {
  const trade: PerformanceTrade = { id: document.id, symbol: document.symbol, direction: document.direction,
    openedAt: document.openedAt, closedAt: document.closedAt, resultR: document.resultR,
    entryPrice: document.entryPrice, exitPrice: document.exitPrice,
    ...(document.source === "breakout" ? { source: "breakout" as const } : {}) };
  return validatePublishedPerformanceTrade(trade) ? null : trade;
}

export async function getLivePerformanceDataset(): Promise<PerformanceDatasetLoadResult> {
  try {
    const db = getDb();
    const [documents, state, excludedCycles, account] = await Promise.all([
      db.collection<PublishedPerformanceTrade>(PERFORMANCE_COLLECTIONS.publishedTrades).find({}, { projection: PUBLIC_TRADE_PROJECTION }).sort({ closedAt: -1 }).toArray(),
      db.collection<{ _id: string; firstSyncAt: Date; lastSuccessAt: Date }>(PERFORMANCE_COLLECTIONS.syncState).findOne({ _id: process.env.BYBIT_ENV ?? "demo" }),
      db.collection<{ _id: string }>(PERFORMANCE_COLLECTIONS.positionCycles).find({ $or: [{ excludedFromJournal: true }, { publicationHold: true }] }, { projection: { _id: 1 } }).toArray(),
      readBreakoutAccount(db),
    ]);
    if (!state?.firstSyncAt && !account) return { status: "unavailable", dataset: null };
    const excluded = excludedTradeIds(excludedCycles);
    const sourceFrom = activeBreakoutHistoryFrom(account);
    const activeAccount = sourceFrom ? { historyFrom: sourceFrom } : null;
    const selected = documents.filter(doc => !excluded.has(doc._id) && (doc.source === "breakout" ? !!sourceFrom && doc.openedAt >= sourceFrom : isLegacyHistory(doc, activeAccount)));
    const trades = await enrichPublicTrades(selected.map(toPublicTrade).filter((trade): trade is PerformanceTrade => !!trade));
    const inceptionAt = state?.firstSyncAt ?? new Date(account!.historyFrom);
    const asOf = new Date(Math.max(inceptionAt.getTime(), state?.lastSuccessAt?.getTime() ?? 0,
      account?.lastImportedAt.getTime() ?? 0, account?.activatedAt?.getTime() ?? 0, ...selected.map(doc => doc.updatedAt?.getTime() ?? 0)));
    return { status: "available", dataset: { id: "live", label: activeAccount ? "Breakout and earlier history" : "Journal history",
      description: "Published closed trades", inceptionAt: inceptionAt.toISOString(), asOf: asOf.toISOString(), trades } };
  } catch {
    console.error("[performance/data] stored journal unavailable");
    return { status: "unavailable", dataset: null };
  }
}

export async function getLivePerformanceTrade(id: string): Promise<PerformanceTradeLoadResult> {
  const result = await getLivePerformanceDataset();
  if (result.status !== "available") return { status: "unavailable", trade: null };
  const trade = result.dataset.trades.find(trade => trade.id === id);
  return trade ? { status: "available", trade } : { status: "not-found", trade: null };
}
