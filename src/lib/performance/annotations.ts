import "server-only";
import { createHash } from "node:crypto";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { classifyLegacyTags, EMPTY_ANNOTATION, normalizeTagName, parseAnnotation, TRADE_ID_PATTERN, type TradeAnnotation } from "./annotations-model";
import { METADATA_COLLECTION, type PublicMetadataDocument } from "./public-metadata";
import { PERFORMANCE_COLLECTIONS } from "./sync";
import { publicTradeIdForCycle } from "./publication";
import { getLivePerformanceTrade } from "./data";
import type { TradeTag } from "./types";

export const STRATEGY_COLLECTION = "performance_strategy_catalogue";
export const REVIEW_COLLECTION = "performance_private_reviews";
export const REVIEW_HISTORY_COLLECTION = "performance_private_review_history";
export interface PrivateReviewDocument {
  _id: string; strategyIds: string[]; revision: number; privateNotes: string; asrComments: string;
  expectedR: number | null; valid: boolean | null; updatedAt: Date; updatedBy: string;
}
interface EditableCycle {
  _id: string; status: string; lastSeenAt: Date;
  reviewCandidate?: { id: string }; publishedTradeId?: string;
}
export class AnnotationConflictError extends Error {}
export class AnnotationTargetError extends Error {}
export class AnnotationInputError extends Error {}

/** Resolve a known trade in the current account, including an active cycle's future trade ID. */
export async function resolveAnnotationTarget(id: string): Promise<{ closed: boolean } | null> {
  if (!TRADE_ID_PATTERN.test(id)) return null;
  if ((await getLivePerformanceTrade(id)).status === "available") return { closed: true };
  const db = getDb();
  const environment = process.env.BYBIT_ENV ?? "demo";
  const state = await db.collection<{ _id: string; lastRunId: string; lastSuccessAt: Date }>(PERFORMANCE_COLLECTIONS.syncState).findOne({ _id: environment });
  if (!state) return null;
  const run = await db.collection<{ _id: string; sourceAccountId: string }>(PERFORMANCE_COLLECTIONS.syncRuns).findOne({ _id: state.lastRunId });
  if (!run?.sourceAccountId) return null;
  const cycles = await db.collection<EditableCycle>(PERFORMANCE_COLLECTIONS.positionCycles).find({
    environment, sourceAccountId: run.sourceAccountId,
    $or: [{ status: "pending_review", "reviewCandidate.id": id }, { status: { $in: ["open", "excluded"] }, lastSeenAt: state.lastSuccessAt }],
  }, { projection: { status: 1, lastSeenAt: 1, reviewCandidate: 1 } }).toArray();
  const cycle = cycles.find((item) => publicTradeIdForCycle(item._id) === id);
  return cycle ? { closed: cycle.status === "pending_review" } : null;
}

export async function getTagCatalogue(): Promise<TradeTag[]> {
  const db = getDb();
  const [tags, legacy] = await Promise.all([
    db.collection<{ _id: string; name: string }>(STRATEGY_COLLECTION).find({}, { projection: { name: 1 } }).toArray(),
    db.collection<{ _id: string; name: string }>("performance_tag_catalogue").find({}, { projection: { name: 1 } }).toArray(),
  ]);
  const oldTags = legacy.map(tag => ({ id: tag._id, name: tag.name }));
  return [...new Map([...oldTags.filter(tag => classifyLegacyTags([tag.id], oldTags).strategyIds.length), ...tags.map(tag => ({ id: tag._id, name: tag.name }))].map(tag => [tag.id, tag])).values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTradeAnnotations(ids: string[]): Promise<Record<string, TradeAnnotation>> {
  if (!ids.length) return {};
  const db = getDb();
  const [publicDocs, privateDocs] = await Promise.all([
    db.collection<PublicMetadataDocument & { tagIds?: string[] }>(METADATA_COLLECTION).find({ _id: { $in: ids } }, { projection: { tagIds: 1, tradeType: 1, description: 1 } }).toArray(),
    db.collection<PrivateReviewDocument>(REVIEW_COLLECTION).find({ _id: { $in: ids } }, { projection: { strategyIds: 1, revision: 1, privateNotes: 1, asrComments: 1, expectedR: 1, valid: 1 } }).toArray(),
  ]);
  const publicById = new Map(publicDocs.map((doc) => [doc._id, doc]));
  const privateById = new Map(privateDocs.map((doc) => [doc._id, doc]));
  // A restored legacy dev snapshot is readable privately until migration runs again.
  const legacyIds = [...new Set(publicDocs.flatMap(doc => doc.tagIds ?? []))];
  const legacyTags = legacyIds.length ? await db.collection<{ _id: string; name: string }>("performance_tag_catalogue").find({ _id: { $in: legacyIds } }, { projection: { name: 1 } }).toArray() : [];
  return Object.fromEntries(ids.map((id) => {
    const pub = publicById.get(id); const priv = privateById.get(id);
    const legacy = classifyLegacyTags(pub?.tagIds ?? [], legacyTags.map(tag => ({ id: tag._id, name: tag.name })));
    const tradeType = pub?.tradeType === undefined ? legacy.tradeType : pub.tradeType;
    return [id, { revision: priv?.revision ?? 0, tradeType: tradeType === "DAY" || tradeType === "SWING" ? tradeType : null, strategyIds: [...new Set([...(priv?.strategyIds ?? []), ...legacy.strategyIds])].sort(), description: pub?.description ?? "",
      privateNotes: priv?.privateNotes ?? "", asrComments: priv?.asrComments ?? "", expectedR: priv?.expectedR ?? null, valid: priv?.valid ?? null }];
  }));
}

export async function createStrategyTag(value: unknown, userId: string): Promise<TradeTag> {
  const name = normalizeTagName(value);
  const normalizedName = name.toLocaleLowerCase("en");
  const id = `tag-${createHash("sha256").update(normalizedName).digest("hex").slice(0, 20)}`;
  const collection = getDb().collection<{ _id: string; name: string; normalizedName: string; createdAt: Date; createdBy: string }>(STRATEGY_COLLECTION);
  await collection.updateOne({ _id: id }, { $setOnInsert: { name, normalizedName, createdAt: new Date(), createdBy: userId } }, { upsert: true });
  const tag = await collection.findOne({ _id: id });
  return { id, name: tag!.name };
}

export async function saveTradeAnnotation(id: string, value: unknown, userId: string): Promise<TradeAnnotation> {
  const target = await resolveAnnotationTarget(id);
  if (!target) throw new AnnotationTargetError("Trade not found");
  let annotation: TradeAnnotation;
  try { annotation = parseAnnotation(value, target.closed); } catch (error) { throw new AnnotationInputError(error instanceof Error ? error.message : "Invalid edit"); }
  const db = getDb();
  const catalogue = await getTagCatalogue();
  if (annotation.strategyIds.some(id => !catalogue.some(tag => tag.id === id))) throw new AnnotationInputError("One of these strategies is no longer available");
  const session = getMongoClient().startSession();
  const now = new Date();
  try {
    await session.withTransaction(async () => {
      const reviews = db.collection<PrivateReviewDocument>(REVIEW_COLLECTION);
      const existing = await reviews.findOne({ _id: id }, { session });
      if ((existing?.revision ?? 0) !== annotation.revision) throw new AnnotationConflictError("This trade was edited elsewhere. Reopen the editor to load the latest changes.");
      const previousPublic = await db.collection<PublicMetadataDocument>(METADATA_COLLECTION).findOne({ _id: id }, { session });
      const before: TradeAnnotation = { ...EMPTY_ANNOTATION, ...existing,
        revision: existing?.revision ?? 0, tradeType: previousPublic?.tradeType ?? null, strategyIds: existing?.strategyIds ?? [], description: previousPublic?.description ?? "" };
      const next = { ...annotation, revision: annotation.revision + 1 };
      for (const tag of catalogue.filter(tag => next.strategyIds.includes(tag.id))) await db.collection<{ _id: string; name: string }>(STRATEGY_COLLECTION).updateOne({ _id: tag.id }, { $setOnInsert: { name: tag.name } }, { upsert: true, session });
      await reviews.replaceOne({ _id: id }, { revision: next.revision, strategyIds: next.strategyIds, privateNotes: next.privateNotes,
        asrComments: next.asrComments, expectedR: next.expectedR, valid: next.valid, updatedAt: now, updatedBy: userId }, { upsert: true, session });
      await db.collection<PublicMetadataDocument>(METADATA_COLLECTION).replaceOne({ _id: id }, { tradeType: next.tradeType, description: next.description }, { upsert: true, session });
      await db.collection<{ _id: string; tradeId: string; before: TradeAnnotation; after: TradeAnnotation; changedAt: Date; changedBy: string; legacyPublicBefore?: PublicMetadataDocument }>(REVIEW_HISTORY_COLLECTION)
        .insertOne({ _id: `${id}:${next.revision}`, tradeId: id, before: {
          revision: before.revision, tradeType: before.tradeType, strategyIds: before.strategyIds, description: before.description, privateNotes: before.privateNotes,
          asrComments: before.asrComments, expectedR: before.expectedR, valid: before.valid,
        }, after: next, changedAt: now, changedBy: userId, ...(previousPublic ? { legacyPublicBefore: previousPublic } : {}) }, { session });
    });
  } finally { await session.endSession(); }
  return { ...annotation, revision: annotation.revision + 1 };
}
