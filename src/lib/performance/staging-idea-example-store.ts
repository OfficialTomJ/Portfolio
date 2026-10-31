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
