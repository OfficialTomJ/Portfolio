"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, ColorType, LineSeries, LineStyle, createChart, createSeriesMarkers, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type Time } from "lightweight-charts";
import { loadIdeaChartMarket } from "@/lib/performance/idea-chart-market";
import { tradeChartMarkers } from "@/lib/performance/idea-chart-markers";
import type { IdeaChart } from "@/lib/performance/idea-timeline-model";
import type { MarketCandles, PerformanceTrade, TradeCandleInterval } from "@/lib/performance/types";

interface Props {
  symbol:string; start:number; end:number; interval:TradeCandleInterval;
  levels?:IdeaChart; trades:PerformanceTrade[];
  selectedTrade:string; showTrades:boolean; showLevels:boolean;
}
export default function IdeaPriceChart(props:Props) {
  const [market,setMarket]=useState<MarketCandles|null>(null),[error,setError]=useState("");
  const {symbol,start,end,interval}=props;
  useEffect(()=>{
    const controller=new AbortController();
    loadIdeaChartMarket({symbol,start,end,interval,signal:controller.signal}).then(setMarket).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[symbol,start,end,interval]);
  return market?<RenderedChart {...props} market={market}/>:<div role="status" className="grid h-80 place-items-center px-6 text-center text-xs leading-5 text-zinc-500">{error||"Loading reference chart…"}</div>;
}

type ChartState={chart:IChartApi;markers:ISeriesMarkersPluginApi<Time>;target:ISeriesApi<"Line">;invalidation:ISeriesApi<"Line">};
function RenderedChart({symbol,interval,market,levels,trades,selectedTrade,showTrades,showLevels}:Props&{market:MarketCandles}) {
  const ref=useRef<HTMLDivElement>(null),instance=useRef<ChartState|null>(null);
  const candles=useMemo(()=>[...new Map(market.candles.map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time),[market]);
  // The chart belongs to the candle dataset. Overlay changes must never recreate it or fit its viewport.
  useEffect(()=>{
    const node=ref.current;if(!node)return;
    const chart=createChart(node,{autoSize:true,layout:{background:{type:ColorType.Solid,color:"transparent"},textColor:"#a1a1aa",fontSize:11,fontFamily:"inherit",attributionLogo:false},grid:{vertLines:{color:"rgba(255,255,255,.04)"},horzLines:{color:"rgba(255,255,255,.04)"}},rightPriceScale:{borderColor:"rgba(255,255,255,.1)",minimumWidth:65},timeScale:{timeVisible:interval!=="1d",secondsVisible:false,borderColor:"rgba(255,255,255,.1)"}});
    const reference=candles[0]?.close??1,precision=reference>=1000?2:reference>=1?4:Math.min(10,Math.ceil(-Math.log10(reference))+4);
    const priceFormat={type:"price" as const,precision,minMove:10**-precision};
    const series=chart.addSeries(CandlestickSeries,{priceFormat,upColor:"#22c55e",downColor:"#ef4444",wickUpColor:"#22c55e",wickDownColor:"#ef4444",borderVisible:false,priceLineVisible:false,lastValueVisible:false});
    series.setData(candles.map(c=>({...c,time:c.time as Time})));
    const line=(color:string,title:string)=>chart.addSeries(LineSeries,{priceFormat,color,title,lineWidth:1,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false});
    instance.current={chart,markers:createSeriesMarkers(series,[]),target:line("#22c55e","Target"),invalidation:line("#ef4444","Invalidation")};
    chart.timeScale().fitContent();
    return()=>{instance.current=null;chart.remove();};
  },[candles,interval]);
  useEffect(()=>{
    instance.current?.markers.setMarkers(showTrades?tradeChartMarkers(candles,trades,selectedTrade,interval):[]);
  },[candles,interval,trades,selectedTrade,showTrades]);
  useEffect(()=>{
    const current=instance.current;if(!current)return;
    for(const [series,price] of [[current.target,levels?.targetPrice],[current.invalidation,levels?.invalidationPrice]] as const) {
      const visible=showLevels&&levels?.symbol===symbol&&price!=null;
      series.applyOptions({visible});
      series.setData(visible&&candles.length?[{time:candles[0].time as Time,value:price},{time:candles.at(-1)!.time as Time,value:price}]:[]);
    }
  },[candles,symbol,levels,showLevels]);
  return <><div ref={ref} data-idea-chart role="img" aria-label={`${symbol} ${interval} reference chart with target, invalidation and closed trade markers. Recorded fills are listed below.`} className="h-80 w-full min-w-0 sm:h-[380px]"/><p className="border-t border-white/[.06] px-4 py-2 text-[10px] leading-5 text-zinc-500">{market.source==="binance"?"Binance":"Bybit"} {symbol} · {interval==="1d"?"Daily":interval.toUpperCase()} reference candles. Blue markers show trade entries/exits; select a trade for its fills. Reference prices can differ from actual fills.</p></>;
}
