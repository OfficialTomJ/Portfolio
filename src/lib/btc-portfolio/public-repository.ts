import "server-only";
import { MongoClient } from "mongodb";
import { getMongoClient } from "@/lib/mongodb";
import { portfolioPublicEnabled } from "./mode";
import { portfolioPublicDatabaseName } from "./mode-policy";
import { visitorPortfolio } from "./visitor-projection";

declare global {
  var _portfolioProductionClient: MongoClient | undefined;
}

/** Public readers have no dependency on private workspace/source repositories. */
export function publicPortfolioStorage() {
  if (!portfolioPublicEnabled()) throw new Error("Public portfolio is disabled.");
  const production = process.env.VERCEL_ENV === "production";
  const dbName = portfolioPublicDatabaseName({ VERCEL_ENV: process.env.VERCEL_ENV, MONGODB_DB: process.env.MONGODB_DB, PORTFOLIO_MONGODB_DB: process.env.PORTFOLIO_MONGODB_DB });
  let client: MongoClient;
  if (production) {
    const uri = process.env.PORTFOLIO_MONGODB_URI;
    if (!uri) throw new Error("Production portfolio connection is not configured.");
    global._portfolioProductionClient ??= new MongoClient(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10 });
    client = global._portfolioProductionClient;
  } else client = getMongoClient();
  const db = client.db(dbName, { ignoreUndefined: true });
  return { db, key: production ? "public-portfolio-v1" : "staging-portfolio-v1", releases: production ? "portfolio_public_releases" : "portfolio_review_public_releases", pointers: production ? "portfolio_public_pointers" : "portfolio_review_public_pointers" };
}
export async function loadDatabasePortfolio() {
  const { db, key, releases, pointers } = publicPortfolioStorage();
  const pointer = await db.collection<{ _id: string; releaseId: string }>(pointers).findOne({ _id: key }, { projection: { releaseId: 1 } });
  if (!pointer) throw new Error("No reviewed public portfolio release is available.");
  const release = await db.collection<{ _id: string; workspaceId: string; data: unknown }>(releases).findOne({ _id: pointer.releaseId, workspaceId: key }, { projection: { data: 1 } });
  if (!release) throw new Error("Public portfolio release is unavailable.");
  return visitorPortfolio(release.data);
}
