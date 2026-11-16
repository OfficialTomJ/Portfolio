import "server-only";
import { getMongoClient } from "@/lib/mongodb";
import { publicSchema, type PublicPortfolio } from "./schema";
import { portfolioStoriesSchema } from "./stories";

/** Local preview projections only. Never reads trading facts or article drafts into the visitor response. */
export async function withLocalPortfolioStories(data: PublicPortfolio): Promise<PublicPortfolio> {
  const base = { ...data, activity: [], campaigns: [], points: data.points.map(point => ({ ...point, weights: {} })) };
  if (process.env.NODE_ENV !== "development") return publicSchema.parse(base);
  const record = await getMongoClient().db("blueprint_dev").collection<{ _id: string; data: unknown }>("portfolio_local_story_releases")
    .findOne({ _id: "active" }, { projection: { _id: 0, data: 1 } });
  return publicSchema.parse({ ...base, stories: record ? portfolioStoriesSchema.parse(record.data) : undefined });
}
