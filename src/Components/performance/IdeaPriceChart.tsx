"use client";
import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, ColorType, LineSeries, LineStyle, createChart, createSeriesMarkers, type SeriesMarker, type Time } from "lightweight-charts";
import { eventCandle, type IdeaMilestone } from "@/lib/performance/idea-timeline";
import type { MarketCandles, PerformanceTrade, TradeCandleInterval } from "@/lib/performance/types";

interface Props {
  symbol:string; start:number; end:number; interval:TradeCandleInterval;
  milestones:IdeaMilestone[]; active:IdeaMilestone; trades:PerformanceTrade[];
  selectedTrade:string; showTrades:boolean; showLevels:boolean; showUpdates:boolean;
}
export default function IdeaPriceChart(props:Props) {
  const [market,setMarket]=useState<MarketCandles|null>(null),[error,setError]=useState("");
  const {symbol,start,end,interval}=props;
  useEffect(()=>{
    const controller=new AbortController(),query=new URLSearchParams({symbol,start:String(start),end:String(end),interval,direction:"window"});
    fetch(`/api/performance/market?${query}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error("Reference chart is temporarily unavailable. The thesis and trade record remain available below.");const data=await r.json() as MarketCandles;if(!data.candles?.length)throw Error("No reference candles are available for this market and window.");setMarket(data);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[symbol,start,end,interval]);
  return market?<RenderedChart {...props} market={market}/>:<div role="status" className="grid h-80 place-items-center px-6 text-center text-sm leading-6 text-zinc-500">{error||"Loading reference chart…"}</div>;
}

function RenderedChart({symbol,interval,market,milestones,active,trades,selectedTrade,showTrades,showLevels,showUpdates}:Props&{market:MarketCandles}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=ref.current;
    if(!node)return;
    const candles=[...new Map(market.candles.map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time);
    const chart=createChart(node,{autoSize:true,layout:{background:{type:ColorType.Solid,color:"transparent"},textColor:"#a1a1aa",fontFamily:"inherit",attributionLogo:false},grid:{vertLines:{color:"rgba(255,255,255,.04)"},horzLines:{color:"rgba(255,255,255,.04)"}},rightPriceScale:{borderColor:"rgba(255,255,255,.1)",minimumWidth:65},timeScale:{timeVisible:interval!=="1d",secondsVisible:false,borderColor:"rgba(255,255,255,.1)"}});
    const reference=candles[0]?.close??1;
    const precision=reference>=1000?2:reference>=1?4:Math.min(10,Math.ceil(-Math.log10(reference))+4);
    const priceFormat={type:"price" as const,precision,minMove:10**-precision};
    const series=chart.addSeries(CandlestickSeries,{priceFormat,upColor:"#22c55e",downColor:"#ef4444",wickUpColor:"#22c55e",wickDownColor:"#ef4444",borderVisible:false,priceLineVisible:false,lastValueVisible:false});
    series.setData(candles.map(c=>({...c,time:c.time as Time})));
    const markers:SeriesMarker<Time>[]=[];
    if(showUpdates)for(const milestone of milestones) {
      if(milestone.chart&&milestone.chart.symbol!==symbol)continue;
      const time=eventCandle(candles,milestone.at,interval);
      if(time!==null)markers.push({time:time as Time,position:"aboveBar",shape:"square",color:milestone.id===active.id?"#ff8b52":"#a1a1aa",text:milestone.id===active.id?"Thesis":""});
    }
    if(showTrades) {
      if(selectedTrade) {
        const trade=trades.find(t=>t.id===selectedTrade);
        if(trade)for(const [at,entry] of [[trade.openedAt,true],[trade.closedAt,false]] as const) {
          const time=eventCandle(candles,at,interval);
          if(time!==null)markers.push({time:time as Time,position:entry?"belowBar":"aboveBar",shape:entry?"arrowUp":"arrowDown",color:entry?"#60a5fa":"#c4b5fd",text:entry?"Entry":"Exit"});
        }
      } else {
        const buckets=new Map<number,number>();
        for(const trade of trades)for(const at of [trade.openedAt,trade.closedAt]) {const time=eventCandle(candles,at,interval);if(time!==null)buckets.set(time,(buckets.get(time)??0)+1);}
        for(const [time,count] of buckets)markers.push({time:time as Time,position:"belowBar",shape:"circle",color:"#60a5fa",text:count>1?String(count):""});
      }
    }
    markers.sort((a,b)=>Number(a.time)-Number(b.time));
    createSeriesMarkers(series,markers);
    if(showLevels&&active.chart?.symbol===symbol) {
      const from=Date.parse(active.at)/1000<candles[0].time?candles[0].time:eventCandle(candles,active.at,interval);
      const next=milestones.find(m=>Date.parse(m.at)>Date.parse(active.at));
      const to=next&&Date.parse(next.at)/1000<=candles[0].time?null:next?eventCandle(candles,next.at,interval)??candles.at(-1)!.time:candles.at(-1)!.time;
      if(from!==null&&to!==null&&to>from)for(const [price,color,title] of [[active.chart.targetPrice,"#22c55e","Target"],[active.chart.invalidationPrice,"#ef4444","Invalidation"]] as const) {
        if(price===null)continue;
        const line=chart.addSeries(LineSeries,{priceFormat,color,lineWidth:1,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:true,title,crosshairMarkerVisible:false});
        line.setData([{time:from as Time,value:price},{time:to as Time,value:price}]);
      }
    }
    chart.timeScale().fitContent();
    return()=>chart.remove();
  },[symbol,interval,market,milestones,active,trades,selectedTrade,showTrades,showLevels,showUpdates]);
  return <><div ref={ref} data-idea-chart role="img" aria-label={`${symbol} ${interval} reference chart with selectable thesis levels and published closed trade markers. The timeline and trade list provide the same event details in text.`} className="h-80 w-full min-w-0 sm:h-[420px]"/><p className="border-t border-white/[.06] px-4 py-3 text-[10px] leading-5 text-zinc-500">{market.source==="binance"?"Binance":"Bybit"} {symbol} reference candles · {interval.toUpperCase()} · Blue dots: entry/exit events, grouped by candle. Select a trade to isolate its entry and exit. Orange square: selected thesis. Reference prices can differ from actual fills.</p></>;
}
