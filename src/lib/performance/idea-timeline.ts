import type { PublicIdea } from "./workspace-model";
import { ideaChartLevels, type IdeaChart } from "./idea-timeline-model";
import type { PerformanceTrade, TradeCandle, TradeCandleInterval } from "./types";

export interface IdeaMilestone { id:string; at:string; publishedAt:string; title:string; thesis:string; target:string; invalidation:string; chart?:IdeaChart }
export function ideaMilestones(idea:PublicIdea):IdeaMilestone[] {
  const initial:IdeaMilestone={id:"initial",at:idea.ideaAt,publishedAt:idea.firstPublishedAt,title:"Initial thesis",thesis:idea.thesis,target:idea.target,invalidation:idea.invalidation,chart:idea.chart};
  const result=[initial];
  for(const update of [...(idea.updates??[])].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id))) {
    const previous=result.at(-1)!;
    result.push({...update,publishedAt:update.publishedAt??idea.updatedAt,target:update.target||previous.target,invalidation:update.invalidation||previous.invalidation,chart:update.chart===null?undefined:update.chart??previous.chart});
  }
  return result;
}
export function ideaMarkets(idea:PublicIdea,trades:PerformanceTrade[]):string[] {
  return [...new Set([...ideaChartLevels(idea).map(chart=>chart.symbol),...trades.map(t=>t.symbol)].filter((v):v is string=>!!v))];
}
/** Exact symbols only: no other market may contribute markers or a trade range. */
export function ideaMarketTrades(trades:PerformanceTrade[],symbol:string):PerformanceTrade[] {
  return trades.filter(trade=>trade.symbol===symbol).sort((a,b)=>Date.parse(a.openedAt)-Date.parse(b.openedAt));
}
export function ideaChartWindow(milestones:IdeaMilestone[],trades:PerformanceTrade[],focusAt:string,selectedTrade?:PerformanceTrade,now=Date.now(),requestedInterval?:TradeCandleInterval) {
  const day=86400000;
  const times=[...milestones.map(m=>Date.parse(m.at)),...trades.flatMap(t=>[Date.parse(t.openedAt),Date.parse(t.closedAt)])];
  const first=selectedTrade?Date.parse(selectedTrade.openedAt):Math.min(...times);
  const last=selectedTrade?Date.parse(selectedTrade.closedAt):Math.max(...times);
  const interval:TradeCandleInterval=requestedInterval??(last-first>77*day?"1d":"4h");
  const step=interval==="1h"?3600000:interval==="4h"?14400000:day;
  const history=interval==="1h"?7*day:interval==="4h"?14*day:90*day;
  let start=first-history,end=Math.min(now,last+3*day),clipped=false;
  // A bounded request can be paged in full at every chosen timeframe.
  const maximum=Math.min(470*day,1498*step);
  if(end-start>maximum) {
    clipped=true;
    const focus=selectedTrade?Date.parse(selectedTrade.closedAt):Date.parse(focusAt);
    start=Math.max(start,Math.min(focus-maximum/2,end-maximum));
    end=Math.min(end,start+maximum);
  }
  return {start:Math.floor(Math.max(1,start)/1000),end:Math.ceil(end/1000),interval,clipped};
}

/** Never pin an event outside available candles to the nearest edge of the chart. */
export function eventCandle(candles:TradeCandle[],at:string,interval:TradeCandleInterval):number|null {
  const time=Date.parse(at)/1000,step=interval==="1d"?86400:interval==="4h"?14400:3600;
  const first=candles[0]?.time,last=candles.at(-1)?.time;
  if(first===undefined||last===undefined||time<first||time>=last+step)return null;
  const candle=candles.findLast(c=>c.time<=time);
  return candle&&time<candle.time+step?candle.time:null;
}
