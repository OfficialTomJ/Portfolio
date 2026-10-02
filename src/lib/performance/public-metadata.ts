import "server-only";
import { getDb } from "@/lib/mongodb";
import type { PerformanceTrade, TradeType } from "./types";

export const METADATA_COLLECTION = "performance_trade_metadata";
export interface PublicMetadataDocument { _id: string; tradeType: TradeType | null; description: string }

export async function enrichPublicTrades(trades: PerformanceTrade[]): Promise<PerformanceTrade[]> {
  if (!trades.length) return trades;
  const db = getDb();
  // Private review collections are deliberately never read by the public loader.
  const metadata = await db.collection<PublicMetadataDocument>(METADATA_COLLECTION)
    .find({ _id: { $in: trades.map((trade) => trade.id) } }, { projection: { tradeType: 1, description: 1 } }).toArray();
  const byId = new Map(metadata.map((item) => [item._id, item]));
  return trades.map((trade) => {
    const item = byId.get(trade.id);
    return { ...trade, tradeType: item?.tradeType === "DAY" || item?.tradeType === "SWING" ? item.tradeType : null, description: item?.description ?? "" };
  });
}
