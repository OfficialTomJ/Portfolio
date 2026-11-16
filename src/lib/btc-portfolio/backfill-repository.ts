import "server-only";
import { getMongoClient } from "@/lib/mongodb";
import { btcMockEnabled } from "./mode";
import { publicSchema, type PublicPortfolio } from "./schema";

interface ReconstructionRecord {
  _id: string; status: string; fingerprint: string; publicData: unknown; assumptions: string[];
  chronology: { at: string; asset: string; action: string; price?: string; note: string }[];
  sourceUrls: string[]; targetAllocationPct: number;
}
export interface ReconstructionReview extends Omit<ReconstructionRecord, "publicData"> { publicData: PublicPortfolio }
const db = () => {
  if (!btcMockEnabled()) throw new Error("Local portfolio review is disabled.");
  return getMongoClient().db("blueprint_dev");
};
export async function loadActiveReconstructionPublic(): Promise<PublicPortfolio | null> {
  const pointer = await db().collection<{ _id: string; reconstructionId: string }>("btc_portfolio_review_settings").findOne({ _id: "localhost-active-reconstruction" });
  if (!pointer) return null;
  const record = await db().collection<ReconstructionRecord>("btc_portfolio_reconstructions").findOne({ _id: pointer.reconstructionId, status: "locked-estimate" }, { projection: { publicData: 1 } });
  if (!record) throw new Error("Selected reconstruction is unavailable.");
  return publicSchema.parse(record.publicData);
}
export async function loadReconstructionReview(): Promise<ReconstructionReview | null> {
  const pointer = await db().collection<{ _id: string; reconstructionId: string }>("btc_portfolio_review_settings").findOne({ _id: "localhost-active-reconstruction" });
  if (!pointer) return null;
  const record = await db().collection<ReconstructionRecord>("btc_portfolio_reconstructions").findOne({ _id: pointer.reconstructionId }, { projection: { publicData: 1, status: 1, fingerprint: 1, assumptions: 1, chronology: 1, sourceUrls: 1, targetAllocationPct: 1 } });
  if (!record) throw new Error("Selected reconstruction is unavailable.");
  return { ...record, publicData: publicSchema.parse(record.publicData) };
}
