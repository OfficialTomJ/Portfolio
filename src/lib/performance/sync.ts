import "server-only";

import { createHash, randomUUID } from "crypto";
import type { Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  fetchBybitSnapshot,
  type BybitClosedPnl,
  type BybitExecution,
  type BybitOrder,
  type BybitPosition,
} from "./bybit";
import { normalizeClosedCycle } from "./normalize";
import type { PerformanceTrade, TradeDirection } from "./types";

export const PERFORMANCE_COLLECTIONS = {
  closedPnl: "performance_private_closed_pnl",
  executions: "performance_private_executions",
  orders: "performance_private_orders",
  positionCycles: "performance_private_position_cycles",
  publishedTrades: "performance_published_trades",
  syncRuns: "performance_private_sync_runs",
  syncState: "performance_private_sync_state",
} as const;

type CycleStatus = "open" | "awaiting_close" | "unresolved" | "published";

interface PositionCycleDocument {
  _id: string;
  environment: string;
  symbol: string;
  direction: TradeDirection;
  positionIdx: number;
  openedAt: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  entryPrice: number;
  quantity: number;
  leverage: number | null;
  initialStopPrice?: number;
  stopCapturedAt?: Date;
  status: CycleStatus;
  resolutionIssue?: string;
  closedAt?: Date;
  publishedTradeId?: string;
}

interface PrivateExecutionDocument extends BybitExecution {
  _id: string;
  environment: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface PrivateOrderDocument extends BybitOrder {
  _id: string;
  environment: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface PrivateClosedPnlDocument extends BybitClosedPnl {
  _id: string;
  environment: string;
  cycleId?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface PublishedPerformanceTrade extends PerformanceTrade {
  _id: string;
  source: "bybit";
  publishedAt: Date;
  updatedAt: Date;
}

interface SyncRunDocument {
  _id: string;
  environment: string;
  startedAt: Date;
  completedAt?: Date;
  status: "running" | "succeeded" | "failed";
  counts?: PerformanceSyncResult;
  error?: string;
}

interface SyncStateDocument {
  _id: string;
  firstSyncAt: Date;
  lastSuccessAt: Date;
  lastRunId: string;
  counts: PerformanceSyncResult;
}

export interface PerformanceSyncResult {
  positionsCaptured: number;
  executionsUpserted: number;
  ordersUpserted: number;
  closedPnlUpserted: number;
  tradesPublished: number;
  unresolvedCycles: number;
}

function numberValue(value: string | number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: string | number | undefined, fallback: Date): Date {
  const timestamp = numberValue(value);
  return timestamp > 0 ? new Date(timestamp) : fallback;
}

function positionDirection(side: BybitPosition["side"]): TradeDirection {
  return side === "Sell" ? "Short" : "Long";
}

function closedPositionDirection(side: BybitClosedPnl["side"]): TradeDirection {
  return side === "Sell" ? "Long" : "Short";
}

function cycleId(environment: string, position: BybitPosition, openedAt: Date): string {
  return [environment, "linear", position.symbol, position.positionIdx, openedAt.getTime()].join(":");
}

function publicTradeId(sourceCycleId: string): string {
  return `trade-${createHash("sha256").update(sourceCycleId).digest("hex").slice(0, 20)}`;
}

function privateId(environment: string, externalId: string): string {
  return `${environment}:${externalId}`;
}

async function ensureIndexes() {
  const db = getDb();
  await Promise.all([
    db.collection<PositionCycleDocument>(PERFORMANCE_COLLECTIONS.positionCycles)
      .createIndex({ environment: 1, status: 1, openedAt: -1 }),
    db.collection<PrivateClosedPnlDocument>(PERFORMANCE_COLLECTIONS.closedPnl)
      .createIndex({ environment: 1, cycleId: 1, updatedTime: 1 }),
    db.collection<PublishedPerformanceTrade>(PERFORMANCE_COLLECTIONS.publishedTrades)
      .createIndex({ closedAt: -1 }),
    db.collection<SyncRunDocument>(PERFORMANCE_COLLECTIONS.syncRuns)
      .createIndex({ startedAt: -1 }),
  ]);
}

async function upsertExecutions(
  collection: Collection<PrivateExecutionDocument>,
  environment: string,
  executions: BybitExecution[],
  capturedAt: Date
) {
  for (const execution of executions) {
    await collection.updateOne(
      { _id: privateId(environment, execution.execId) },
      {
        $set: { ...execution, environment, lastSeenAt: capturedAt },
        $setOnInsert: { firstSeenAt: capturedAt },
      },
      { upsert: true }
    );
  }
}

async function upsertOrders(
  collection: Collection<PrivateOrderDocument>,
  environment: string,
  orders: BybitOrder[],
  capturedAt: Date
) {
  for (const order of orders) {
    await collection.updateOne(
      { _id: privateId(environment, order.orderId) },
      {
        $set: { ...order, environment, lastSeenAt: capturedAt },
        $setOnInsert: { firstSeenAt: capturedAt },
      },
      { upsert: true }
    );
  }
}

async function upsertClosedPnl(
  collection: Collection<PrivateClosedPnlDocument>,
  environment: string,
  records: BybitClosedPnl[],
  capturedAt: Date
) {
  for (const record of records) {
    await collection.updateOne(
      { _id: privateId(environment, record.orderId) },
      {
        $set: { ...record, environment, lastSeenAt: capturedAt },
        $setOnInsert: { firstSeenAt: capturedAt },
      },
      { upsert: true }
    );
  }
}

async function capturePositionCycles(
  collection: Collection<PositionCycleDocument>,
  environment: string,
  positions: BybitPosition[],
  capturedAt: Date
): Promise<Set<string>> {
  const active = new Set<string>();

  for (const position of positions) {
    const openedAt = dateValue(position.openTime, dateValue(position.createdTime, capturedAt));
    const id = cycleId(environment, position, openedAt);
    const existing = await collection.findOne({ _id: id });
    const stop = numberValue(position.stopLoss);
    active.add(id);

    await collection.updateOne(
      { _id: id },
      {
        $set: {
          environment,
          symbol: position.symbol,
          direction: positionDirection(position.side),
          positionIdx: position.positionIdx,
          openedAt,
          lastSeenAt: capturedAt,
          entryPrice: numberValue(position.avgPrice),
          quantity: numberValue(position.size),
          leverage: numberValue(position.leverage) || null,
          status: "open",
          ...(existing?.initialStopPrice || stop <= 0
            ? {}
            : { initialStopPrice: stop, stopCapturedAt: capturedAt }),
        },
        $setOnInsert: { firstSeenAt: capturedAt },
        $unset: { resolutionIssue: "", closedAt: "" },
      },
      { upsert: true }
    );
  }

  return active;
}

async function assignClosedPnlToCycles(
  cycles: PositionCycleDocument[],
  closedPnl: Collection<PrivateClosedPnlDocument>,
  environment: string
) {
  const records = await closedPnl
    .find({ environment, execType: "Trade" })
    .sort({ updatedTime: 1 })
    .toArray();
  const orderedCycles = [...cycles].sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());

  for (const record of records) {
    const closedAt = dateValue(record.updatedTime, record.lastSeenAt);
    const direction = closedPositionDirection(record.side);
    const match = orderedCycles.find(
      (cycle) =>
        cycle.symbol === record.symbol &&
        cycle.direction === direction &&
        cycle.openedAt.getTime() <= closedAt.getTime()
    );
    if (match && record.cycleId !== match._id) {
      await closedPnl.updateOne({ _id: record._id }, { $set: { cycleId: match._id } });
    }
  }
}

async function publishClosedCycles(
  cycles: Collection<PositionCycleDocument>,
  closedPnl: Collection<PrivateClosedPnlDocument>,
  published: Collection<PublishedPerformanceTrade>,
  environment: string,
  activeIds: Set<string>,
  capturedAt: Date
): Promise<{ published: number; unresolved: number }> {
  const candidates = await cycles
    .find({ environment, status: { $in: ["open", "awaiting_close", "unresolved"] } })
    .sort({ openedAt: -1 })
    .toArray();

  await assignClosedPnlToCycles(candidates, closedPnl, environment);

  let publishedCount = 0;
  let unresolvedCount = 0;

  for (const cycle of candidates) {
    if (activeIds.has(cycle._id)) continue;

    const records = await closedPnl
      .find({ environment, cycleId: cycle._id, execType: "Trade" })
      .sort({ updatedTime: 1 })
      .toArray();
    if (!records.length) {
      await cycles.updateOne(
        { _id: cycle._id },
        { $set: { status: "awaiting_close", resolutionIssue: "No closed PnL record captured" } }
      );
      continue;
    }

    const id = publicTradeId(cycle._id);
    const normalized = normalizeClosedCycle(
      {
        id,
        symbol: cycle.symbol,
        direction: cycle.direction,
        openedAt: cycle.openedAt,
        fallbackEntryPrice: cycle.entryPrice,
        initialStopPrice: cycle.initialStopPrice,
      },
      records
    );

    if (!normalized.ok) {
      unresolvedCount += 1;
      await cycles.updateOne(
        { _id: cycle._id },
        {
          $set: {
            status: "unresolved",
            resolutionIssue: normalized.reason === "missing_stop"
              ? "Initial stop was not captured"
              : "Captured risk data is invalid",
          },
        }
      );
      continue;
    }

    const closedAt = new Date(normalized.trade.closedAt);
    const publicRecord: PublishedPerformanceTrade = {
      _id: id,
      ...normalized.trade,
      source: "bybit",
      publishedAt: capturedAt,
      updatedAt: capturedAt,
    };

    await published.updateOne(
      { _id: id },
      { $set: publicRecord },
      { upsert: true }
    );
    await cycles.updateOne(
      { _id: cycle._id },
      {
        $set: {
          status: "published",
          closedAt,
          publishedTradeId: id,
        },
        $unset: { resolutionIssue: "" },
      }
    );
    publishedCount += 1;
  }

  return { published: publishedCount, unresolved: unresolvedCount };
}

function safeError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown sync error";
  return error.message.replace(/api[_ -]?key|secret/gi, "credential").slice(0, 500);
}

export async function syncPerformanceJournal(): Promise<PerformanceSyncResult> {
  await ensureIndexes();
  const db = getDb();
  const runId = randomUUID();
  const startedAt = new Date();
  const runs = db.collection<SyncRunDocument>(PERFORMANCE_COLLECTIONS.syncRuns);
  await runs.insertOne({
    _id: runId,
    environment: process.env.BYBIT_ENV ?? "unknown",
    startedAt,
    status: "running",
  });

  try {
    const snapshot = await fetchBybitSnapshot();
    const capturedAt = new Date(snapshot.serverTime || Date.now());
    const environment = snapshot.environment;
    const executions = db.collection<PrivateExecutionDocument>(PERFORMANCE_COLLECTIONS.executions);
    const orders = db.collection<PrivateOrderDocument>(PERFORMANCE_COLLECTIONS.orders);
    const closedPnl = db.collection<PrivateClosedPnlDocument>(PERFORMANCE_COLLECTIONS.closedPnl);
    const cycles = db.collection<PositionCycleDocument>(PERFORMANCE_COLLECTIONS.positionCycles);
    const published = db.collection<PublishedPerformanceTrade>(PERFORMANCE_COLLECTIONS.publishedTrades);

    await Promise.all([
      upsertExecutions(executions, environment, snapshot.executions, capturedAt),
      upsertOrders(orders, environment, snapshot.orders, capturedAt),
      upsertClosedPnl(closedPnl, environment, snapshot.closedPnl, capturedAt),
    ]);
    const activeIds = await capturePositionCycles(cycles, environment, snapshot.positions, capturedAt);
    const normalized = await publishClosedCycles(
      cycles,
      closedPnl,
      published,
      environment,
      activeIds,
      capturedAt
    );

    const result: PerformanceSyncResult = {
      positionsCaptured: snapshot.positions.length,
      executionsUpserted: snapshot.executions.length,
      ordersUpserted: snapshot.orders.length,
      closedPnlUpserted: snapshot.closedPnl.length,
      tradesPublished: normalized.published,
      unresolvedCycles: normalized.unresolved,
    };

    await Promise.all([
      runs.updateOne(
        { _id: runId },
        { $set: { status: "succeeded", completedAt: new Date(), counts: result } }
      ),
      db.collection<SyncStateDocument>(PERFORMANCE_COLLECTIONS.syncState).updateOne(
        { _id: environment },
        {
          $set: { lastSuccessAt: capturedAt, lastRunId: runId, counts: result },
          $setOnInsert: { firstSyncAt: capturedAt },
        },
        { upsert: true }
      ),
    ]);

    return result;
  } catch (error) {
    await runs.updateOne(
      { _id: runId },
      { $set: { status: "failed", completedAt: new Date(), error: safeError(error) } }
    );
    throw error;
  }
}
