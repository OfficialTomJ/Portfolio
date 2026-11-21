import "server-only";
import { MongoClient } from "mongodb";
import { getMongoClient } from "@/lib/mongodb";
import { portfolioPublicEnabled } from "./mode";
import { portfolioPublicDatabaseName } from "./mode-policy";
import { visitorPortfolio } from "./visitor-projection";
import { createLivePortfolioReader } from "./live-reader";
import { createMarketQuoteLoader } from "./market-rest";

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
async function loadPortfolioRelease() {
  const { db, key, releases, pointers } = publicPortfolioStorage();
  const pointer = await db.collection<{ _id: string; releaseId: string }>(pointers).findOne({ _id: key }, { projection: { releaseId: 1 } });
  if (!pointer) throw new Error("No reviewed public portfolio release is available.");
  const release = await db.collection<{ _id: string; workspaceId: string; data: unknown }>(releases).findOne({ _id: pointer.releaseId, workspaceId: key }, { projection: { data: 1 } });
  if (!release) throw new Error("Public portfolio release is unavailable.");
  return { id: pointer.releaseId, data: visitorPortfolio(release.data) };
}
/** Editors and immutable social-image generation continue to read the accepted release. */
export async function loadDatabasePortfolio() { return (await loadPortfolioRelease()).data; }

/** Live prices revalue the accepted holdings without reading or modifying private source records. */
export const loadLivePortfolio = createLivePortfolioReader({
  readRelease: loadPortfolioRelease,
  readBasis: async id => {
    const { db } = publicPortfolioStorage();
    const record = await db.collection<{ _id: string; basis: unknown }>("portfolio_public_valuation_bases").findOne({ _id: id }, { projection: { basis: 1 } });
    return record?.basis;
  },
  quote: createMarketQuoteLoader(),
});
