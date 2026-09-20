import "server-only";

import { getDb } from "@/lib/mongodb";
import { PERFORMANCE_COLLECTIONS, type PublishedPerformanceTrade } from "./sync";
import { validatePublishedPerformanceTrade } from "./sync-validation";
import { isPerformanceDatasetStale } from "./health";
import type {
  PerformanceDatasetLoadResult,
  PerformanceTrade,
  PerformanceTradeLoadResult,
} from "./types";

interface SyncStateView {
  _id: string;
  firstSyncAt: Date;
  lastSuccessAt: Date;
}

const PUBLIC_TRADE_PROJECTION = {
  _id: 1,
  id: 1,
  symbol: 1,
  direction: 1,
  openedAt: 1,
  closedAt: 1,
  resultR: 1,
  entryPrice: 1,
  exitPrice: 1,
} as const;

function toPublicTrade(document: PublishedPerformanceTrade): PerformanceTrade | null {
  const trade: PerformanceTrade = {
    id: document.id,
    symbol: document.symbol,
    direction: document.direction,
    openedAt: document.openedAt,
    closedAt: document.closedAt,
    resultR: document.resultR,
    entryPrice: document.entryPrice,
    exitPrice: document.exitPrice,
  };
  const validationIssue = validatePublishedPerformanceTrade(trade);
  if (validationIssue) {
    console.error(
      `[performance/data] ignoring invalid published trade ${document._id}: ${validationIssue}`
    );
    return null;
  }
  return trade;
}

function isPerformanceTrade(trade: PerformanceTrade | null): trade is PerformanceTrade {
  return trade !== null;
}

export async function getLivePerformanceDataset(): Promise<PerformanceDatasetLoadResult> {
  const now = new Date();
  try {
    const db = getDb();
    const environment = process.env.BYBIT_ENV ?? "demo";
    const [documents, state] = await Promise.all([
      db.collection<PublishedPerformanceTrade>(PERFORMANCE_COLLECTIONS.publishedTrades)
        .find({}, { projection: PUBLIC_TRADE_PROJECTION })
        .sort({ closedAt: -1 })
        .toArray(),
      db.collection<SyncStateView>(PERFORMANCE_COLLECTIONS.syncState).findOne({ _id: environment }),
    ]);
    if (!state?.lastSuccessAt || !state.firstSyncAt) {
      console.error(`[performance/data] no successful sync state for ${environment}`);
      return { status: "unavailable", dataset: null };
    }
    const asOf = state.lastSuccessAt;
    const inceptionAt = state.firstSyncAt;

    const trades = documents.map(toPublicTrade).filter(isPerformanceTrade);

    return {
      status: isPerformanceDatasetStale(asOf, now) ? "stale" : "available",
      dataset: {
        id: "live",
        label: "Connected account",
        description: trades.length ? "Published closed trades" : "No published closed trades yet",
        inceptionAt: inceptionAt.toISOString(),
        asOf: asOf.toISOString(),
        trades,
      },
    };
  } catch (error) {
    console.error("[performance/data] failed to load connected dataset", error);
    return {
      status: "unavailable",
      dataset: null,
    };
  }
}

export async function getLivePerformanceTrade(id: string): Promise<PerformanceTradeLoadResult> {
  try {
    const document = await getDb()
      .collection<PublishedPerformanceTrade>(PERFORMANCE_COLLECTIONS.publishedTrades)
      .findOne({ _id: id }, { projection: PUBLIC_TRADE_PROJECTION });
    const trade = document ? toPublicTrade(document) : null;
    return trade
      ? { status: "available", trade }
      : { status: "not-found", trade: null };
  } catch (error) {
    console.error("[performance/data] failed to load connected trade", error);
    return { status: "unavailable", trade: null };
  }
}
