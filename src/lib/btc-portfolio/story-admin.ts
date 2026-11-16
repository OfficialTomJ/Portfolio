import "server-only";
import { getMongoClient } from "@/lib/mongodb";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { activityResearchSchema } from "@/lib/journal/activity-schema";
import { portfolioEditorialNoteSchema, portfolioStoriesSchema } from "./stories";

export async function loadPortfolioStoryAdmin() {
  if (process.env.NODE_ENV !== "development" || !await getPerformanceAdminSession()) return null;
  const db = getMongoClient().db("blueprint_dev");
  const [release, provenance, notes, linkReview] = await Promise.all([
    db.collection<{ _id: string; data: unknown }>("portfolio_local_story_releases").findOne({ _id: "active" }, { projection: { data: 1 } }),
    db.collection<{ _id: string; ideas: { id: string; sources: unknown }[] }>("portfolio_local_story_provenance").findOne({ _id: "active" }, { projection: { ideas: 1 } }),
    db.collection<{ _id: string; status: string; note: unknown }>("portfolio_editorial_notes").find({ status: "approved-localhost" }, { projection: { note: 1 } }).limit(200).toArray(),
    db.collection<{ _id: string; issues?: string[] }>("portfolio_local_link_reviews").findOne({ _id: "2025-published-substack" }, { projection: { issues: 1 } }),
  ]);
  if (!release) return null;
  return { data: portfolioStoriesSchema.parse(release.data), notes: notes.map(row => portfolioEditorialNoteSchema.parse(row.note)), references: (provenance?.ideas ?? []).map(idea => ({ id: idea.id, sources: activityResearchSchema.shape.sources.parse(idea.sources) })), linkReviewIssues: linkReview?.issues ?? [] };
}
