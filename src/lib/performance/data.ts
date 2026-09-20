import "server-only";

import { getDb } from "@/lib/mongodb";
import { performanceDatasets, getMockTrade } from "./mock";
import { PERFORMANCE_COLLECTIONS, type PublishedPerformanceTrade } from "./sync";
import { validatePublishedPerformanceTrade } from "./sync-validation";
import type {
  PerformanceDataset,
  PerformanceDataSource,
  PerformanceTrade,
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

export function parsePerformanceSource(value: string | undefined): PerformanceDataSource {
  return value === "live" ? "live" : "mock";
}

export async function getLivePerformanceDataset(): Promise<PerformanceDataset> {
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
    const asOf = state?.lastSuccessAt ?? now;
    const inceptionAt = state?.firstSyncAt ?? asOf;

    const trades = documents.map(toPublicTrade).filter(isPerformanceTrade);

    return {
      id: "live",
      label: "Connected account",
      description: trades.length ? "Published closed trades" : "No published closed trades yet",
      inceptionAt: inceptionAt.toISOString(),
      asOf: asOf.toISOString(),
      trades,
    };
  } catch (error) {
    console.error("[performance/data] failed to load connected dataset", error);
    return {
      id: "live-unavailable",
      label: "Connected account",
      description: "Connected data is temporarily unavailable",
      inceptionAt: now.toISOString(),
      asOf: now.toISOString(),
      trades: [],
    };
  }
}

export async function getPerformanceDataset(
  source: PerformanceDataSource
): Promise<PerformanceDataset> {
  return source === "live" ? getLivePerformanceDataset() : performanceDatasets.mature;
}

export async function getPerformanceTrade(
  source: PerformanceDataSource,
  id: string
): Promise<PerformanceTrade | null> {
  if (source === "mock") return getMockTrade(id);

  try {
    const document = await getDb()
      .collection<PublishedPerformanceTrade>(PERFORMANCE_COLLECTIONS.publishedTrades)
      .findOne({ _id: id }, { projection: PUBLIC_TRADE_PROJECTION });
    return document ? toPublicTrade(document) : null;
  } catch (error) {
    console.error("[performance/data] failed to load connected trade", error);
    return null;
  }
}
