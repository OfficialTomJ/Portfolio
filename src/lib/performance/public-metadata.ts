import "server-only";
import { getDb } from "@/lib/mongodb";
import type { PerformanceTrade, TradeTag } from "./types";

export const TAG_COLLECTION = "performance_tag_catalogue";
export const METADATA_COLLECTION = "performance_trade_metadata";
export interface PublicMetadataDocument { _id: string; tagIds: string[]; description: string }

export async function enrichPublicTrades(trades: PerformanceTrade[]): Promise<PerformanceTrade[]> {
  if (!trades.length) return trades;
  const db = getDb();
  // Private review collections are deliberately never read by the public loader.
  const metadata = await db.collection<PublicMetadataDocument>(METADATA_COLLECTION)
    .find({ _id: { $in: trades.map((trade) => trade.id) } }, { projection: { tagIds: 1, description: 1 } }).toArray();
  const tagIds = [...new Set(metadata.flatMap((item) => item.tagIds ?? []))];
  const tags = tagIds.length ? await db.collection<{ _id: string; name: string }>(TAG_COLLECTION)
    .find({ _id: { $in: tagIds } }, { projection: { name: 1 } }).toArray() : [];
  const tagById = new Map(tags.map((tag) => [tag._id, { id: tag._id, name: tag.name } satisfies TradeTag]));
  const byId = new Map(metadata.map((item) => [item._id, item]));
  return trades.map((trade) => {
    const item = byId.get(trade.id);
    return { ...trade, tags: (item?.tagIds ?? []).flatMap((id) => tagById.has(id) ? [tagById.get(id)!] : []), description: item?.description ?? "" };
  });
}
