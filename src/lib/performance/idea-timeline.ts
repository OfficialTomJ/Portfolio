import type { PublicIdea } from "./workspace-model";
import type { IdeaChart } from "./idea-timeline-model";
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
  return [...new Set([idea.chart?.symbol,...(idea.updates??[]).map(u=>u.chart?.symbol),...trades.map(t=>t.symbol)].filter((v):v is string=>!!v))];
}
export function ideaChartWindow(milestones:IdeaMilestone[],trades:PerformanceTrade[],focusAt:string,selectedTrade?:PerformanceTrade,now=Date.now()) {
  const times=[...milestones.map(m=>Date.parse(m.at)),...trades.flatMap(t=>[Date.parse(t.openedAt),Date.parse(t.closedAt)])];
  const padding=3*86400000;
  let start=(selectedTrade?Date.parse(selectedTrade.openedAt):Math.min(...times))-padding;
  let end=Math.min(now,(selectedTrade?Date.parse(selectedTrade.closedAt):Math.max(...times))+padding);
  let clipped=false;
  if(end-start>470*86400000) {
    clipped=true;
    const focus=selectedTrade?Date.parse(selectedTrade.closedAt):Date.parse(focusAt);
    start=Math.max(start,Math.min(focus-200*86400000,end-470*86400000));
    end=Math.min(end,start+470*86400000);
  }
  const interval:TradeCandleInterval=end-start<=77*86400000?"4h":"1d";
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
