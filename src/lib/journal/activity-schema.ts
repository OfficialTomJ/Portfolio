import { z } from "zod";

const at = z.iso.datetime({ offset: true });
const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const finite = z.number().finite();
export const articleLinkSchema = z.string().trim().max(700).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port && (url.hostname === "substack.com" || url.hostname.endsWith(".substack.com")) && /^\/p\/[^/]+/.test(url.pathname); } catch { return false; }
}, "Use an HTTPS Substack article link, or leave it blank.");
export const snapshotSchema = z.object({
  equityUsd: decimal, perpsEquityUsd: decimal, spotEquityUsd: decimal, grossExposureUsd: decimal,
  netExposureUsd: decimal, perpGrossUsd: decimal, assetSpotUsd: decimal, assetPerpUsd: decimal,
  positionQuantity: decimal, grossLeverage: finite.nullable(), perpAccountLeverage: finite.nullable(),
}).strict();
export const executionSchema = z.object({
  id: z.string().max(180), at, market: z.enum(["spot", "perp"]), asset: z.string().max(30), sourceAsset: z.string().max(30),
  side: z.enum(["buy", "sell"]), quantity: decimal, price: decimal, fee: decimal, feeAsset: z.string().max(30), feeUsd: decimal,
  sourceClosedPnlUsd: decimal, realizedPnlUsd: decimal.nullable(), sourceOrderId: z.string().max(60), sourceFillId: z.string().max(60),
  sourceHash: z.string().max(160), before: snapshotSchema, after: snapshotSchema,
}).strict();
export type ActivityExecution = z.infer<typeof executionSchema>;
export type ActivitySnapshot = z.infer<typeof snapshotSchema>;
export const stageSchema = z.object({
  id, action: z.string().max(80), at, endAt: at, orderCount: z.number().int().positive(), fillCount: z.number().int().positive(),
  quantity: decimal, vwap: decimal, notionalUsd: decimal, feesUsd: decimal, realizedPnlUsd: decimal.nullable(),
  sourceClosedPnlUsd: decimal, fundingUsd: decimal, before: snapshotSchema, after: snapshotSchema,
  exposureChangePct: finite.nullable(), signedExposureChangePct: finite.nullable(), spotWeightChangePct: finite.nullable(),
  factualReason: z.string().max(2000), fills: z.array(executionSchema).min(1).max(20000),
}).strict();
export type ActivityStage = z.infer<typeof stageSchema>;
export const groupFactsSchema = z.object({
  id, year: z.number().int(), kind: z.enum(["position", "spot-batch", "cash-transition"]), asset: z.string().max(30), market: z.enum(["spot", "perp", "context"]),
  title: z.string().max(200), at, endAt: at, chartScope: z.enum(["in-chart", "pre-chart", "spans-baseline"]),
  carriedIn: z.boolean(), reversal: z.boolean(), factualReason: z.string().max(3000),
  orderCount: z.number().int().nonnegative(), fillCount: z.number().int().nonnegative(),
  feesUsd: decimal, realizedPnlUsd: decimal.nullable(), fundingUsd: decimal,
  peakWalletLeverage: finite.nullable(), peakAssetLeverage: finite.nullable(),
  stages: z.array(stageSchema).max(2000), notes: z.array(z.string().max(1500)).max(30),
  contextEvidence: z.array(z.object({ at, type: z.string().max(100), detail: z.string().max(1500) }).strict()).max(100),
}).strict();
export type ActivityGroupFacts = z.infer<typeof groupFactsSchema>;
export const metricModes = ["action-only", "wallet-exposure", "spot-weight"] as const;
const privateSourceLink = z.string().url().max(700).refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash
    && url.hostname.endsWith(".substack.com") && /^\/(?:p\/[^/]+|publish\/post\/\d+)\/?$/.test(url.pathname);
}, "Use a Substack article or editor link without preview tokens.");
/** Private attribution only; never included in the future-public activity projection. */
export const activityResearchSchema = z.object({
  basis: z.enum(["direct", "context", "execution", "owner-context"]), preparedAt: at,
  explanation: z.string().max(2000),
  sources: z.array(z.object({
    title: z.string().max(300), url: privateSourceLink, articleUrl: articleLinkSchema,
    at, status: z.enum(["draft", "published"]), relationship: z.enum(["direct", "context"]),
    timing: z.enum(["contemporaneous", "retrospective"]),
  }).strict()).max(5),
}).strict();
export const reviewSchema = z.object({
  status: z.enum(["pending", "reviewed", "excluded"]), grouping: z.enum(["proposed", "confirmed", "needs-changes"]),
  reason: z.string().trim().max(3000), rationaleConfirmed: z.boolean(), articleUrl: articleLinkSchema,
  metricMode: z.enum(metricModes), privateNote: z.string().max(4000),
  stages: z.array(z.object({ id, reason: z.string().trim().max(2000), articleUrl: articleLinkSchema, include: z.boolean() }).strict()).max(2000),
  research: activityResearchSchema.optional(),
}).strict();
export type ActivityReview = z.infer<typeof reviewSchema>;
export interface ActivityGroupDocument { _id: string; year: number; revision: number; facts: ActivityGroupFacts; review: ActivityReview; sourceFingerprint: string; updatedAt: string; audit: { at: string; actor: string; requestId: string; hash: string; review: ActivityReview }[] }
export interface ActivityGroupDetail { revision: number; facts: ActivityGroupFacts; review: ActivityReview; updatedAt: string }
export interface ActivityGroupSummary {
  id: string; year: number; revision: number; title: string; asset: string; market: ActivityGroupFacts["market"]; at: string; endAt: string;
  kind: ActivityGroupFacts["kind"]; chartScope: ActivityGroupFacts["chartScope"]; carriedIn: boolean; reversal: boolean;
  orderCount: number; fillCount: number; stageCount: number; peakWalletLeverage: number | null;
  review: ActivityReview; updatedAt: string;
}
export const manifestSchema = z.object({
  year: z.number().int(), from: at, until: at, baselineAt: at, preparedAt: at, sourceFingerprint: z.string(),
  groupCount: z.number().int(), tradingGroups: z.number().int(), stageCount: z.number().int(),
  sourceFillCount: z.number().int(), coveredFillCount: z.number().int(), dustFillCount: z.number().int(),
  spotOrders: z.number().int(), perpOrders: z.number().int(), excludedGoldFills: z.number().int(), preChartGroups: z.number().int(),
  positionMismatches: z.number().int(), cashReconciles: z.boolean(), fillsCoveredExactlyOnce: z.boolean(),
  fundingCoverageComplete: z.boolean(), notes: z.array(z.string()),
}).strict();
export type ActivityManifest = z.infer<typeof manifestSchema>;
export interface ActivityQueue { manifest: ActivityManifest; groups: ActivityGroupSummary[] }
export const activitySaveSchema = z.object({
  id, year: z.number().int().min(2009).max(2100), revision: z.number().int().nonnegative(), requestId: z.uuid(), review: reviewSchema,
}).strict();
