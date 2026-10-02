import "server-only";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { classifyLegacyTags, EMPTY_ANNOTATION } from "./annotations-model";
import { STRATEGY_COLLECTION, REVIEW_COLLECTION, REVIEW_HISTORY_COLLECTION, type PrivateReviewDocument } from "./annotations";
import { METADATA_COLLECTION, type PublicMetadataDocument } from "./public-metadata";
import type { TradeTag } from "./types";

export const LEGACY_TAG_COLLECTION = "performance_tag_catalogue";
type LegacyMetadata = PublicMetadataDocument & { tagIds?: string[] };

/** Dry-run by default. Only metadata, private catalogue and revision history are written. */
export async function migrateTradeTags(apply = false) {
  const db = getDb();
  const catalogue = await db.collection<{ _id: string; name: string }>(LEGACY_TAG_COLLECTION).find({}).toArray();
  const tags: TradeTag[] = catalogue.map(tag => ({ id: tag._id, name: tag.name }));
  const strategies = catalogue.filter(tag => classifyLegacyTags([tag._id], tags).strategyIds.length);
  const documents = await db.collection<LegacyMetadata>(METADATA_COLLECTION).find({ tagIds: { $exists: true } }).toArray();
  const report = { apply, legacyRecords: documents.length, strategies: strategies.length, conflicts: documents.filter(doc => classifyLegacyTags(doc.tagIds ?? [], tags).conflict).length, migrated: 0 };
  if (!apply) return report;
  const session = getMongoClient().startSession();
  try {
    // Catalogue copying is idempotent and never changes existing strategy names.
    for (const tag of strategies) await db.collection<{ _id: string; name: string }>(STRATEGY_COLLECTION).updateOne({ _id: tag._id }, { $setOnInsert: { name: tag.name } }, { upsert: true });
    for (const document of documents) {
      const migrated = await session.withTransaction(async () => {
        const current = await db.collection<LegacyMetadata>(METADATA_COLLECTION).findOne({ _id: document._id, tagIds: { $exists: true } }, { session });
        if (!current) return false;
        const previous = await db.collection<PrivateReviewDocument>(REVIEW_COLLECTION).findOne({ _id: document._id }, { session });
        const classification = classifyLegacyTags(current.tagIds ?? [], tags);
        const next = { ...EMPTY_ANNOTATION, ...previous, revision: (previous?.revision ?? 0) + 1,
          tradeType: current.tradeType === undefined ? classification.tradeType : current.tradeType,
          strategyIds: [...new Set([...(previous?.strategyIds ?? []), ...classification.strategyIds])].sort(), description: current.description ?? "" };
        await db.collection<PrivateReviewDocument>(REVIEW_COLLECTION).replaceOne({ _id: document._id }, {
          revision: next.revision, strategyIds: next.strategyIds, privateNotes: next.privateNotes, asrComments: next.asrComments,
          expectedR: next.expectedR, valid: next.valid, updatedAt: new Date(), updatedBy: "metadata-migration",
        }, { session, upsert: true });
        await db.collection<PublicMetadataDocument>(METADATA_COLLECTION).replaceOne({ _id: document._id }, { tradeType: next.tradeType, description: next.description }, { session });
        await db.collection<{ _id: string; tradeId: string; before: unknown; after: unknown; changedAt: Date; changedBy: string; classificationConflict: boolean }>(REVIEW_HISTORY_COLLECTION).insertOne({ _id: `${document._id}:${next.revision}`,
          tradeId: document._id, before: { public: current, private: previous },
          after: { tradeType: next.tradeType, strategyIds: next.strategyIds, revision: next.revision },
          changedAt: new Date(), changedBy: "metadata-migration", classificationConflict: classification.conflict,
        }, { session });
        return true;
      });
      if (migrated) report.migrated++;
    }
  } finally { await session.endSession(); }
  return report;
}
