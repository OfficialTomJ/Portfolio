import type { SeriesMarker, Time } from "lightweight-charts";
import { eventCandle } from "./idea-timeline";
import type { PerformanceTrade, TradeCandle, TradeCandleInterval } from "./types";

/** Only published executions belong on the idea chart; analysis has no execution marker. */
export function tradeChartMarkers(candles:TradeCandle[],trades:PerformanceTrade[],selectedTrade:string,interval:TradeCandleInterval):SeriesMarker<Time>[] {
  const markers:SeriesMarker<Time>[]=[];
  if(selectedTrade) {
    const trade=trades.find(t=>t.id===selectedTrade);
    if(trade)for(const [at,entry] of [[trade.openedAt,true],[trade.closedAt,false]] as const) {
      const time=eventCandle(candles,at,interval);
      if(time!==null)markers.push({time:time as Time,position:entry?"belowBar":"aboveBar",shape:entry?"arrowUp":"arrowDown",color:entry?"#60a5fa":"#c4b5fd",text:entry?"Entry":"Exit"});
    }
  } else {
    const buckets=new Map<number,number>();
    for(const trade of trades)for(const at of [trade.openedAt,trade.closedAt]) {
      const time=eventCandle(candles,at,interval);if(time!==null)buckets.set(time,(buckets.get(time)??0)+1);
    }
    for(const [time,count] of buckets)markers.push({time:time as Time,position:"belowBar",shape:"circle",color:"#60a5fa",text:count>1?String(count):""});
  }
  return markers.sort((a,b)=>Number(a.time)-Number(b.time));
}
