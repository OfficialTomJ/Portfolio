import type { PerformanceTrade } from "./types";
import { validatePublishedPerformanceTrade } from "./sync-validation";

export function isStagingIdeaExampleEnvironment(env:{MONGODB_DB?:string;NEXT_PUBLIC_SITE_URL?:string;VERCEL_ENV?:string}):boolean {
  return env.MONGODB_DB==="blueprint_dev"&&env.NEXT_PUBLIC_SITE_URL==="https://mentor.stage.thomas-johnston.com"&&env.VERCEL_ENV!=="production";
}
/** Explicit public fields only. Demo executions never enter the journal dataset or its totals. */
export function stagingExampleTrades(value:unknown):PerformanceTrade[] {
  if(!Array.isArray(value)||value.length>20)return [];
  const result:PerformanceTrade[]=[];
  for(const raw of value) {
    if(!raw||typeof raw!=="object")return [];
    const t=raw as PerformanceTrade;
    const trade:PerformanceTrade={id:t.id,symbol:t.symbol,direction:t.direction,openedAt:t.openedAt,closedAt:t.closedAt,entryPrice:t.entryPrice,exitPrice:t.exitPrice,resultR:t.resultR,description:typeof t.description==="string"?t.description.slice(0,500):"Staging demonstration trade"};
    if(validatePublishedPerformanceTrade(trade)||result.some(r=>r.id===trade.id))return [];
    result.push(trade);
  }
  return result;
}
