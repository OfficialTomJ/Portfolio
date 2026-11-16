import "server-only";
import { createHash } from "node:crypto";
import { getMongoClient } from "@/lib/mongodb";
import { combineCurrentPortfolioResults, currentPerformanceProjectionSchema } from "./prop-performance";
import type { PublicPortfolio } from "./schema";

export async function withLocalPropPerformance(current: PublicPortfolio): Promise<PublicPortfolio> {
  if (process.env.NODE_ENV !== "development") return current;
  const record = await getMongoClient().db("blueprint_dev").collection<{ _id: string; data: unknown }>("portfolio_local_current_performance")
    .findOne({ _id: String(new Date(current.inceptionAt).getUTCFullYear()) }, { projection: { _id: 0, data: 1 } });
  if (!record) return current;
  const data = currentPerformanceProjectionSchema.parse(record.data);
  const fingerprint = createHash("sha256").update(JSON.stringify(current.points.map(({ at, portfolioIndex, btcIndex }) => ({ at, portfolioIndex, btcIndex })))).digest("hex");
  if (data.spotFingerprint !== fingerprint || data.inceptionAt !== current.inceptionAt || data.asOf !== current.asOf || data.points[0].at !== current.inceptionAt || data.points.at(-1)!.at !== current.asOf)
    throw new Error("The prop contribution needs reconciliation against the updated spot record.");
  for (let i = 1; i < data.points.length; i++) if (Date.parse(data.points[i].at) <= Date.parse(data.points[i - 1].at)) throw new Error("Invalid contribution chronology.");
  return combineCurrentPortfolioResults(current, data);
}
