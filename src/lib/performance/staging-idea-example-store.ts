import "server-only";
import { getDb } from "@/lib/mongodb";
import { isStagingIdeaExampleEnvironment, stagingExampleTrades } from "./staging-idea-example";

export async function getStagingIdeaExampleTrades(ideaId:string) {
  if(!isStagingIdeaExampleEnvironment({MONGODB_DB:process.env.MONGODB_DB,NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL,VERCEL_ENV:process.env.VERCEL_ENV}))return [];
  try {
    const document=await getDb().collection<{_id:string;trades:unknown}>("performance_staging_idea_examples").findOne({_id:ideaId},{projection:{trades:1}});
    return stagingExampleTrades(document?.trades);
  } catch { return []; }
}

/** Display-only detail pages use the same staging-only records; they never join journal results. */
export async function getStagingIdeaExampleTrade(id:string) {
  if(!/^trade-[a-f0-9]{20}$/.test(id)||!isStagingIdeaExampleEnvironment({MONGODB_DB:process.env.MONGODB_DB,NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL,VERCEL_ENV:process.env.VERCEL_ENV}))return null;
  try {
    const db=getDb(),document=await db.collection<{_id:string;trades:unknown}>("performance_staging_idea_examples").findOne({"trades.id":id},{projection:{trades:1}});
    if(!document||!/^idea-[a-f0-9-]{36}$/.test(document._id))return null;
    const trade=stagingExampleTrades(document.trades).find(t=>t.id===id);
    if(!trade||!await db.collection<{_id:string}>("performance_published_ideas").findOne({_id:document._id},{projection:{_id:1}}))return null;
    return {trade,ideaId:document._id};
  } catch { return null; }
}
