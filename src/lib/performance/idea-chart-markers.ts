import type { SeriesMarker, Time } from "lightweight-charts";
import { eventCandle } from "./idea-timeline";
import type { PerformanceTrade, TradeCandle, TradeCandleInterval } from "./types";

export type TradeChartMarker = SeriesMarker<Time> & {tradeId:string;leg:"entry"|"exit";side:"buy"|"sell"};
export function executionSide(direction:PerformanceTrade["direction"],entry:boolean):"buy"|"sell" {
  return (direction==="Long")===entry?"buy":"sell";
}
/** Preserve a marker identity for each execution, including several fills in one candle. */
export function tradeChartMarkers(candles:TradeCandle[],trades:PerformanceTrade[],selectedTrade:string,interval:TradeCandleInterval):TradeChartMarker[] {
  const markers:TradeChartMarker[]=[];
  for(const trade of trades) {
    if(selectedTrade&&trade.id!==selectedTrade)continue;
    for(const [at,leg] of [[trade.openedAt,"entry"],[trade.closedAt,"exit"]] as const) {
      const time=eventCandle(candles,at,interval);if(time===null)continue;
      const side=executionSide(trade.direction,leg==="entry"),buy=side==="buy";
      markers.push({id:`${trade.id}:${leg}`,tradeId:trade.id,leg,side,time:time as Time,position:buy?"belowBar":"aboveBar",shape:buy?"arrowUp":"arrowDown",color:buy?"#22c55e":"#ef4444",text:selectedTrade?`${buy?"Buy":"Sell"} · ${leg==="entry"?"Entry":"Exit"}`:""});
    }
  }
  return markers.sort((a,b)=>Number(a.time)-Number(b.time)||a.tradeId.localeCompare(b.tradeId)||a.leg.localeCompare(b.leg));
}

/** Missing endpoint candles must not invent a holding period at the chart edge. */
export function tradeChartPeriod(candles:TradeCandle[],trade:PerformanceTrade,interval:TradeCandleInterval) {
  const entry=eventCandle(candles,trade.openedAt,interval),exit=eventCandle(candles,trade.closedAt,interval);
  return entry===null||exit===null?null:{entry,exit};
}

/** Clip a visible holding period without drawing a false band when both ends are off screen. */
export function visibleTradePeriod(entryX:number,exitX:number,paneWidth:number,barSpacing:number) {
  const padding=Math.max(4,barSpacing/2),left=Math.max(0,Math.min(entryX,exitX)-padding),right=Math.min(paneWidth,Math.max(entryX,exitX)+padding);
  return right>left?{left,width:right-left}:null;
}
