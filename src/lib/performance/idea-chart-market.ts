import type { MarketCandles, TradeCandleInterval } from "./types";

interface Query { symbol:string; start:number; end:number; interval:TradeCandleInterval; signal?:AbortSignal }
/** The market endpoint returns at most 500 bars. Page the entire bounded window so later fills stay visible. */
export async function loadIdeaChartMarket({symbol,start,end,interval,signal}:Query,request:typeof fetch=fetch):Promise<MarketCandles> {
  const step=interval==="1h"?3600:interval==="4h"?14400:86400;
  const first=Math.floor(start/step)*step;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||first<=0||end<=start||end-first>2000*step)throw Error("The reference chart date range is too large. Select a trade to focus its entry and exit.");
  let market:MarketCandles|undefined;
  for(let from=first;from<end;from+=500*step) {
    const through=Math.min(end,from+500*step-1);
    const query=new URLSearchParams({symbol,start:String(from),end:String(through),interval,direction:"window",...(market?{source:market.source}:{})});
    const response=await request(`/api/performance/market?${query}`,{signal});
    if(!response.ok)throw Error("Reference chart is temporarily unavailable. The idea and trades remain available below.");
    const page=await response.json() as MarketCandles;
    if(!Array.isArray(page.candles)||!['binance','bybit'].includes(page.source)||market&&page.source!==market.source)throw Error("Reference candles could not be loaded consistently. The recorded trades remain available below.");
    market=market?{source:market.source,candles:[...market.candles,...page.candles]}:page;
  }
  if(!market?.candles.length)throw Error("No reference candles are available for this market and window.");
  return {source:market.source,candles:[...new Map(market.candles.filter(c=>c.time>=first&&c.time<=end).map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time)};
}
