import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "../mongodb";
import { getLivePerformanceDataset } from "../performance/data";
import { buildPerformanceView, sydneyYear } from "../performance/metrics";
import { journalSocialImageKey, socialImagePath, tradeSocialImageKey } from "../performance/social-image-keys";
import { assertStoredImageIntegrity } from "../performance/social-images";
import { PERFORMANCE_SOCIAL_IMAGE_COLLECTION, type PerformanceSocialImageDocument } from "../performance/social-image-types";
import { imageCoverageHealth, syncHealth, type HealthResult } from "./policy";

// This module only reads existing service records. It does not run a sync,
// render an image, initialize indexes, or mutate the production database.
export async function checkPerformanceSync(now = new Date()): Promise<HealthResult> {
  const db = getDb();
  const environment = process.env.BYBIT_ENV ?? "demo";
  const state = await db.collection<{ _id: string; lastSuccessAt: Date; lastRunId: string }>("performance_private_sync_state")
    .findOne({ _id: environment }, { projection: { lastSuccessAt: 1, lastRunId: 1 } });
  const run = state?.lastRunId ? await db.collection<{ _id: string; environment: string; status: string; completedAt?: Date; sourceAccountId?: string }>("performance_private_sync_runs")
    .findOne({ _id: state.lastRunId }, { projection: { environment: 1, status: 1, completedAt: 1, sourceAccountId: 1 } }) : null;
  return syncHealth({ environment: run?.environment ?? "", expectedEnvironment: environment,
    lastSuccessAt: state?.lastSuccessAt, completedAt: run?.completedAt, runStatus: run?.status,
    sourceAccountId: run?.sourceAccountId, expectedAccountId: process.env.MONITOR_PERFORMANCE_ACCOUNT_ID }, now);
}

export async function checkPerformanceImages(origin: string, now = new Date()): Promise<HealthResult> {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== "https:" || parsedOrigin.origin !== origin) throw new Error("invalid_origin");
  const loaded = await getLivePerformanceDataset();
  if (loaded.status !== "available") return { status: "failed", reason: "public_dataset_unavailable" };
  const { dataset } = loaded;
  const view = buildPerformanceView(dataset, "YTD", sydneyYear(dataset.asOf));
  const journalKey = journalSocialImageKey(dataset, view);
  const dates = await getDb().collection<{ _id: string; updatedAt: Date; publishedAt: Date }>("performance_published_trades")
    .find({ _id: { $in: dataset.trades.map(trade => trade.id) } }, { projection: { updatedAt: 1, publishedAt: 1 } }).toArray();
  const byId = new Map(dates.map(trade => [trade._id, trade.updatedAt ?? trade.publishedAt]));
  // Publication timestamps remain stable across no-change syncs, so repeated
  // sync attempts cannot continually postpone a missing-image alert.
  const journalDates = [new Date(dataset.inceptionAt), ...view.trades.map(trade => byId.get(trade.id))];
  const journalChangedAt = journalDates.every(date => date && Number.isFinite(date.getTime()))
    ? new Date(Math.max(...journalDates.map(date => date!.getTime()))) : undefined;
  const sourceAccount = await getDb().collection<{ _id: string; activatedAt?: Date }>("performance_private_import_accounts").findOne({ _id: "breakout-1" });
  const changedAt = sourceAccount?.activatedAt && journalChangedAt
    ? new Date(Math.max(sourceAccount.activatedAt.getTime(), journalChangedAt.getTime())) : journalChangedAt;
  const required = [...dataset.trades.map(trade => ({ key: tradeSocialImageKey(trade), changedAt: byId.get(trade.id) })),
    { key: journalKey, changedAt }];
  const images = await getDb().collection<PerformanceSocialImageDocument>(PERFORMANCE_SOCIAL_IMAGE_COLLECTION)
    .find({ _id: { $in: required.map(image => image.key) } }).toArray();
  const valid = new Map<string, PerformanceSocialImageDocument>();
  let corrupt = 0;
  for (const image of images) {
    try { assertStoredImageIntegrity(image); valid.set(image._id, image); }
    catch { corrupt++; }
  }
  const coverage = imageCoverageHealth(required, new Set(valid.keys()), corrupt, now);
  if (coverage.status !== "healthy") return coverage;
  const tradeKeys = required.filter(image => image.key !== journalKey);
  const slot = Math.floor(now.getTime() / 900_000);
  const sample = tradeKeys.length ? tradeKeys[slot % tradeKeys.length].key : undefined;
  for (const key of [journalKey, sample].filter((key): key is string => !!key)) {
    const image = valid.get(key)!;
    try {
      const response = await fetch(`${origin}${socialImagePath(key)}`, {
        redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
      const length = Number(response.headers.get("content-length"));
      if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/png" ||
        length > 5_000_000) return { status: "failed", reason: "public_image_unavailable", counts: coverage.counts };
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== image.payloadByteLength || createHash("sha256").update(bytes).digest("hex") !== image.payloadSha256) {
        return { status: "failed", reason: "public_image_integrity_failed", counts: coverage.counts };
      }
    } catch { return { status: "failed", reason: "public_image_unavailable", counts: coverage.counts }; }
  }
  return coverage;
}
