import "server-only";

import { createHash, randomUUID } from "crypto";
import type { Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  fetchBybitAccountIdentity,
  fetchBybitSnapshot,
  type BybitClosedPnl,
  type BybitExecution,
  type BybitOrder,
  type BybitPosition,
} from "./bybit";
import { normalizeClosedCycle } from "./normalize";
import {
  lockPerformanceRisk,
  type PerformanceRiskVersion,
} from "./risk";
import {
  assertValidPerformanceSnapshot,
  validatePublishedPerformanceTrade,
} from "./sync-validation";
import {
  buildPerformanceSnapshotArchive,
  persistPerformanceSnapshotArchive,
  type PerformanceSnapshotBlobDocument,
  type PerformanceSnapshotManifestDocument,
  type PerformanceSnapshotValidation,
} from "./snapshot-archive";
import type { PerformanceTrade, TradeDirection } from "./types";
import {
  PERFORMANCE_SOCIAL_IMAGE_COLLECTION,
  type PerformanceSocialImageDocument,
} from "./social-image-types";

export const PERFORMANCE_COLLECTIONS = {
  closedPnl: "performance_private_closed_pnl",
  executions: "performance_private_executions",
  orders: "performance_private_orders",
  positionCycles: "performance_private_position_cycles",
  riskVersions: "performance_private_risk_versions",
  publishedTrades: "performance_published_trades",
  rawSnapshots: "performance_private_raw_snapshots",
  snapshotBlobs: "performance_private_snapshot_blobs",
  snapshotManifests: "performance_private_snapshot_manifests",
  syncLocks: "performance_private_sync_locks",
  syncRuns: "performance_private_sync_runs",
  syncState: "performance_private_sync_state",
  socialImages: PERFORMANCE_SOCIAL_IMAGE_COLLECTION,
} as const;

const SYNC_LOCK_ID = "performance-journal";
const SYNC_LOCK_TTL_MS = 10 * 60 * 1000;

type CycleStatus = "open" | "awaiting_close" | "unresolved" | "published";

interface PositionCycleDocument {
  _id: string;
  environment: string;
  sourceAccountId?: string;
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
  riskVersionId?: string;
  riskAmount?: number;
  riskCurrency?: "USDT";
  status: CycleStatus;
  resolutionIssue?: string;
  closedAt?: Date;
  publishedTradeId?: string;
}

interface PrivateExecutionDocument extends BybitExecution {
  _id: string;
  environment: string;
  sourceAccountId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface PrivateOrderDocument extends BybitOrder {
  _id: string;
  environment: string;
  sourceAccountId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface PrivateClosedPnlDocument extends BybitClosedPnl {
  _id: string;
  environment: string;
  sourceAccountId: string;
  cycleId?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface RiskVersionDocument {
  _id: string;
  sourceAccountId: string;
  environment: string;
  version: number;
  riskAmount: number;
  currency: "USDT";
  effectiveFrom: Date;
  createdAt: Date;
  reason: string;
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
  sourceAccountId?: string;
  startedAt: Date;
  completedAt?: Date;
  status: "running" | "succeeded" | "failed";
  counts?: PerformanceSyncResult;
  error?: string;
}

interface SyncLockDocument {
  _id: string;
  ownerRunId: string;
  acquiredAt: Date;
  expiresAt: Date;
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

export class PerformanceSyncAlreadyRunningError extends Error {
  constructor() {
    super("A performance synchronization is already running");
    this.name = "PerformanceSyncAlreadyRunningError";
  }
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

function accountScopeId(environment: string, userId: string | number): string {
  return `account-${createHash("sha256")
    .update(`${environment}:${userId}`)
    .digest("hex")
    .slice(0, 20)}`;
}

function legacyCycleId(environment: string, position: BybitPosition, openedAt: Date): string {
  return [environment, "linear", position.symbol, position.positionIdx, openedAt.getTime()].join(":");
}

function cycleId(
  environment: string,
  sourceAccountId: string,
  position: BybitPosition,
  openedAt: Date
): string {
  return [sourceAccountId, environment, "linear", position.symbol, position.positionIdx, openedAt.getTime()].join(":");
}

function publicTradeId(sourceCycleId: string): string {
  return `trade-${createHash("sha256").update(sourceCycleId).digest("hex").slice(0, 20)}`;
}

function privateId(environment: string, externalId: string): string {
  return `${environment}:${externalId}`;
}

function riskDocumentToVersion(document: RiskVersionDocument): PerformanceRiskVersion {
  return {
    id: document._id,
    sourceAccountId: document.sourceAccountId,
    environment: document.environment,
    version: document.version,
    riskAmount: document.riskAmount,
    currency: document.currency,
    effectiveFrom: document.effectiveFrom,
  };
}

async function ensureIndexes() {
  const db = getDb();
  await Promise.all([
    db.collection<PositionCycleDocument>(PERFORMANCE_COLLECTIONS.positionCycles)
      .createIndex({ sourceAccountId: 1, environment: 1, status: 1, openedAt: -1 }),
    db.collection<PrivateClosedPnlDocument>(PERFORMANCE_COLLECTIONS.closedPnl)
      .createIndex({ sourceAccountId: 1, environment: 1, cycleId: 1, updatedTime: 1 }),
    db.collection<RiskVersionDocument>(PERFORMANCE_COLLECTIONS.riskVersions)
      .createIndex({ sourceAccountId: 1, effectiveFrom: -1 }),
    db.collection<RiskVersionDocument>(PERFORMANCE_COLLECTIONS.riskVersions)
      .createIndex({ sourceAccountId: 1, version: 1 }, { unique: true }),
    db.collection<RiskVersionDocument>(PERFORMANCE_COLLECTIONS.riskVersions)
      .createIndex({ sourceAccountId: 1, effectiveFrom: 1 }, { unique: true }),
    db.collection<PublishedPerformanceTrade>(PERFORMANCE_COLLECTIONS.publishedTrades)
      .createIndex({ closedAt: -1 }),
    db.collection<PerformanceSnapshotBlobDocument>(PERFORMANCE_COLLECTIONS.snapshotBlobs)
      .createIndex({ section: 1, createdAt: -1 }),
    db.collection<PerformanceSnapshotManifestDocument>(PERFORMANCE_COLLECTIONS.snapshotManifests)
      .createIndex({ environment: 1, capturedAt: -1 }),
    db.collection<PerformanceSnapshotManifestDocument>(PERFORMANCE_COLLECTIONS.snapshotManifests)
      .createIndex({ "validation.status": 1, capturedAt: -1 }),
    db.collection<SyncRunDocument>(PERFORMANCE_COLLECTIONS.syncRuns)
      .createIndex({ startedAt: -1 }),
    db.collection<SyncLockDocument>(PERFORMANCE_COLLECTIONS.syncLocks)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<PerformanceSocialImageDocument>(PERFORMANCE_COLLECTIONS.socialImages)
      .createIndex({ kind: 1, subjectId: 1, createdAt: -1 }),
    db.collection<PerformanceSocialImageDocument>(PERFORMANCE_COLLECTIONS.socialImages)
      .createIndex({ legacyKeys: 1, createdAt: -1 }),
  ]);
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function acquireSyncLock(
  collection: Collection<SyncLockDocument>,
  ownerRunId: string,
  acquiredAt: Date
): Promise<boolean> {
  try {
    const lock = await collection.findOneAndUpdate(
      {
        _id: SYNC_LOCK_ID,
        $or: [
          { expiresAt: { $lte: acquiredAt } },
          { ownerRunId },
        ],
      },
      {
        $set: {
          ownerRunId,
          acquiredAt,
          expiresAt: new Date(acquiredAt.getTime() + SYNC_LOCK_TTL_MS),
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    return lock?.ownerRunId === ownerRunId;
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
}

async function releaseSyncLock(
  collection: Collection<SyncLockDocument>,
  ownerRunId: string
) {
  await collection.deleteOne({ _id: SYNC_LOCK_ID, ownerRunId });
}

async function loadRiskVersions(
  collection: Collection<RiskVersionDocument>,
  environment: string,
  sourceAccountId: string
): Promise<PerformanceRiskVersion[]> {
  const documents = await collection
    .find({ environment, sourceAccountId })
    .sort({ effectiveFrom: -1, version: -1 })
    .toArray();
  return documents.map(riskDocumentToVersion);
}

export async function setPerformanceRiskVersion(input: {
  riskAmount: number;
  effectiveFrom: Date;
  reason: string;
}): Promise<PerformanceRiskVersion> {
  if (!Number.isFinite(input.riskAmount) || input.riskAmount <= 0) {
    throw new Error("Risk amount must be greater than zero");
  }
  if (Number.isNaN(input.effectiveFrom.getTime())) {
    throw new Error("Risk effective date is invalid");
  }

  await ensureIndexes();
  const identity = await fetchBybitAccountIdentity();
  const sourceAccountId = accountScopeId(identity.environment, identity.apiKey.userID);
  const collection = getDb().collection<RiskVersionDocument>(PERFORMANCE_COLLECTIONS.riskVersions);
  const existing = await collection.findOne({
    sourceAccountId,
    effectiveFrom: input.effectiveFrom,
  });

  if (existing) {
    if (existing.riskAmount !== input.riskAmount) {
      throw new Error("A different risk amount already exists for this effective date");
    }
    return riskDocumentToVersion(existing);
  }

  const latest = await collection.findOne(
    { sourceAccountId },
    { sort: { version: -1 } }
  );
  const version = (latest?.version ?? 0) + 1;
  const id = `${sourceAccountId}:v${version}`;
  const document: RiskVersionDocument = {
    _id: id,
    sourceAccountId,
    environment: identity.environment,
    version,
    riskAmount: input.riskAmount,
    currency: "USDT",
    effectiveFrom: input.effectiveFrom,
    createdAt: new Date(identity.serverTime || Date.now()),
    reason: input.reason.trim().slice(0, 200) || "Risk configuration update",
  };
  await collection.insertOne(document);
  return riskDocumentToVersion(document);
}

async function backfillCycleRiskLocks(
  collection: Collection<PositionCycleDocument>,
  environment: string,
  sourceAccountId: string,
  riskVersions: PerformanceRiskVersion[]
) {
  const cycles = await collection.find({
    environment,
    $or: [
      { sourceAccountId },
      { sourceAccountId: { $exists: false } },
    ],
  }).toArray();

  for (const cycle of cycles) {
    const lockedRisk = lockPerformanceRisk(cycle, riskVersions, cycle.openedAt);
    await collection.updateOne(
      { _id: cycle._id },
      {
        $set: {
          sourceAccountId,
          ...(lockedRisk ?? {}),
        },
      }
    );
  }
}

async function upsertExecutions(
  collection: Collection<PrivateExecutionDocument>,
  environment: string,
  sourceAccountId: string,
  executions: BybitExecution[],
  capturedAt: Date
) {
  for (const execution of executions) {
    await collection.updateOne(
      { _id: privateId(environment, execution.execId) },
      {
        $set: { ...execution, environment, sourceAccountId, lastSeenAt: capturedAt },
        $setOnInsert: { firstSeenAt: capturedAt },
      },
      { upsert: true }
    );
  }
}

async function upsertOrders(
  collection: Collection<PrivateOrderDocument>,
  environment: string,
  sourceAccountId: string,
  orders: BybitOrder[],
  capturedAt: Date
) {
  for (const order of orders) {
    await collection.updateOne(
      { _id: privateId(environment, order.orderId) },
      {
        $set: { ...order, environment, sourceAccountId, lastSeenAt: capturedAt },
        $setOnInsert: { firstSeenAt: capturedAt },
      },
      { upsert: true }
    );
  }
}

async function upsertClosedPnl(
  collection: Collection<PrivateClosedPnlDocument>,
  environment: string,
  sourceAccountId: string,
  records: BybitClosedPnl[],
  capturedAt: Date
) {
  for (const record of records) {
    await collection.updateOne(
      { _id: privateId(environment, record.orderId) },
      {
        $set: { ...record, environment, sourceAccountId, lastSeenAt: capturedAt },
        $setOnInsert: { firstSeenAt: capturedAt },
      },
      { upsert: true }
    );
  }
}

async function capturePositionCycles(
  collection: Collection<PositionCycleDocument>,
  environment: string,
  sourceAccountId: string,
  riskVersions: PerformanceRiskVersion[],
  positions: BybitPosition[],
  capturedAt: Date
): Promise<Set<string>> {
  const active = new Set<string>();

  for (const position of positions) {
    const openedAt = dateValue(position.openTime, dateValue(position.createdTime, capturedAt));
    const newId = cycleId(environment, sourceAccountId, position, openedAt);
    const oldId = legacyCycleId(environment, position, openedAt);
    const existing = await collection.findOne({
      $or: [
        { _id: newId },
        { _id: oldId, sourceAccountId },
        { _id: oldId, sourceAccountId: { $exists: false } },
      ],
    });
    const id = existing?._id ?? newId;
    const lockedRisk = lockPerformanceRisk(existing, riskVersions, openedAt);
    const stop = numberValue(position.stopLoss);
    active.add(id);

    await collection.updateOne(
      { _id: id },
      {
        $set: {
          environment,
          sourceAccountId,
          symbol: position.symbol,
          direction: positionDirection(position.side),
          positionIdx: position.positionIdx,
          openedAt,
          lastSeenAt: capturedAt,
          entryPrice: numberValue(position.avgPrice),
          quantity: numberValue(position.size),
          leverage: numberValue(position.leverage) || null,
          status: "open",
          ...(lockedRisk ?? {}),
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
  environment: string,
  sourceAccountId: string
) {
  const records = await closedPnl
    .find({ environment, sourceAccountId, execType: "Trade" })
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
  sourceAccountId: string,
  activeIds: Set<string>,
  capturedAt: Date
): Promise<{ published: number; unresolved: number }> {
  const candidates = await cycles
    .find({
      environment,
      sourceAccountId,
      status: { $in: ["open", "awaiting_close", "unresolved", "published"] },
    })
    .sort({ openedAt: -1 })
    .toArray();

  await assignClosedPnlToCycles(candidates, closedPnl, environment, sourceAccountId);

  let publishedCount = 0;
  let unresolvedCount = 0;

  for (const cycle of candidates) {
    if (activeIds.has(cycle._id)) continue;

    const records = await closedPnl
      .find({ environment, sourceAccountId, cycleId: cycle._id, execType: "Trade" })
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
        riskAmount: cycle.riskAmount,
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
            resolutionIssue: normalized.reason === "missing_risk"
              ? "Risk version was not configured"
              : "Locked risk data is invalid",
          },
        }
      );
      continue;
    }

    const validationIssue = validatePublishedPerformanceTrade(normalized.trade);
    if (validationIssue) {
      unresolvedCount += 1;
      await cycles.updateOne(
        { _id: cycle._id },
        {
          $set: {
            status: "unresolved",
            resolutionIssue: validationIssue,
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

    const publishResult = await published.updateOne(
      { _id: id },
      { $setOnInsert: publicRecord },
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
    if (publishResult.upsertedCount === 1) publishedCount += 1;
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
  const locks = db.collection<SyncLockDocument>(PERFORMANCE_COLLECTIONS.syncLocks);
  const lockAcquired = await acquireSyncLock(locks, runId, startedAt);
  if (!lockAcquired) throw new PerformanceSyncAlreadyRunningError();
  let runCreated = false;

  try {
    await runs.insertOne({
      _id: runId,
      environment: process.env.BYBIT_ENV ?? "unknown",
      startedAt,
      status: "running",
    });
    runCreated = true;
    const snapshot = await fetchBybitSnapshot();
    let snapshotValidation: PerformanceSnapshotValidation = { status: "accepted" };
    let snapshotValidationError: unknown;
    try {
      assertValidPerformanceSnapshot(snapshot);
    } catch (error) {
      snapshotValidationError = error;
      snapshotValidation = {
        status: "rejected",
        error: safeError(error),
      };
    }
    const archive = buildPerformanceSnapshotArchive(
      runId,
      snapshot,
      new Date(),
      snapshotValidation
    );
    await persistPerformanceSnapshotArchive(
      db.collection<PerformanceSnapshotBlobDocument>(PERFORMANCE_COLLECTIONS.snapshotBlobs),
      db.collection<PerformanceSnapshotManifestDocument>(
        PERFORMANCE_COLLECTIONS.snapshotManifests
      ),
      archive
    );
    if (snapshotValidationError) throw snapshotValidationError;
    const capturedAt = new Date(snapshot.serverTime || Date.now());
    const environment = snapshot.environment;
    const sourceAccountId = accountScopeId(environment, snapshot.apiKey.userID);
    const executions = db.collection<PrivateExecutionDocument>(PERFORMANCE_COLLECTIONS.executions);
    const orders = db.collection<PrivateOrderDocument>(PERFORMANCE_COLLECTIONS.orders);
    const closedPnl = db.collection<PrivateClosedPnlDocument>(PERFORMANCE_COLLECTIONS.closedPnl);
    const cycles = db.collection<PositionCycleDocument>(PERFORMANCE_COLLECTIONS.positionCycles);
    const riskVersionCollection = db.collection<RiskVersionDocument>(PERFORMANCE_COLLECTIONS.riskVersions);
    const published = db.collection<PublishedPerformanceTrade>(PERFORMANCE_COLLECTIONS.publishedTrades);
    const riskVersions = await loadRiskVersions(riskVersionCollection, environment, sourceAccountId);

    await Promise.all([
      upsertExecutions(executions, environment, sourceAccountId, snapshot.executions, capturedAt),
      upsertOrders(orders, environment, sourceAccountId, snapshot.orders, capturedAt),
      upsertClosedPnl(closedPnl, environment, sourceAccountId, snapshot.closedPnl, capturedAt),
      runs.updateOne({ _id: runId }, { $set: { environment, sourceAccountId } }),
    ]);
    await backfillCycleRiskLocks(cycles, environment, sourceAccountId, riskVersions);
    const activeIds = await capturePositionCycles(
      cycles,
      environment,
      sourceAccountId,
      riskVersions,
      snapshot.positions,
      capturedAt
    );
    const normalized = await publishClosedCycles(
      cycles,
      closedPnl,
      published,
      environment,
      sourceAccountId,
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

    try {
      const { publishCurrentPerformanceSocialImages } = await import(
        "./social-image-publisher"
      );
      const imageResult = await publishCurrentPerformanceSocialImages();
      if (imageResult.failures.length) {
        console.error(
          "[performance/sync] journal data published, but some social images failed",
          imageResult.failures
        );
      }
    } catch (error) {
      console.error(
        "[performance/sync] journal data published, but social image publication failed",
        error
      );
    }

    return result;
  } catch (error) {
    if (runCreated) {
      await runs.updateOne(
        { _id: runId },
        { $set: { status: "failed", completedAt: new Date(), error: safeError(error) } }
      );
    }
    throw error;
  } finally {
    try {
      await releaseSyncLock(locks, runId);
    } catch (error) {
      console.error("[performance/sync] failed to release synchronization lock", error);
    }
  }
}
