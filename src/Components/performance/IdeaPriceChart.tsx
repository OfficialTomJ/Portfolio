"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, ColorType, CrosshairMode, LineSeries, LineStyle, createChart, createSeriesMarkers, type MouseEventParams, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type Time } from "lightweight-charts";
import { loadIdeaChartMarket } from "@/lib/performance/idea-chart-market";
import { executionSide, tradeChartMarkers, tradeChartPeriod, visibleTradePeriod, type TradeChartMarker } from "@/lib/performance/idea-chart-markers";
import { signedR } from "@/lib/performance/metrics";
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
  const ref=useRef<HTMLDivElement>(null),periodRef=useRef<HTMLDivElement>(null),instance=useRef<ChartState|null>(null);
  const [hover,setHover]=useState<{id:string;markers:TradeChartMarker[]}|null>(null);
  const candles=useMemo(()=>[...new Map(market.candles.map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time),[market]);
  const markers=useMemo(()=>showTrades?tradeChartMarkers(candles,trades,selectedTrade,interval):[],[candles,trades,selectedTrade,interval,showTrades]);
  const hovered=hover?.markers===markers?markers.find(m=>m.id===hover.id):undefined;
  const focused=showTrades?trades.find(t=>t.id===(hovered?.tradeId??selectedTrade)):undefined;
  // The chart belongs to the candle dataset. Overlay changes must never recreate it or fit its viewport.
  useEffect(()=>{
    const node=ref.current;if(!node)return;
    const chart=createChart(node,{autoSize:true,layout:{background:{type:ColorType.Solid,color:"transparent"},textColor:"#a1a1aa",fontSize:11,fontFamily:"inherit",attributionLogo:false},crosshair:{mode:CrosshairMode.Normal},grid:{vertLines:{color:"rgba(255,255,255,.04)"},horzLines:{color:"rgba(255,255,255,.04)"}},rightPriceScale:{borderColor:"rgba(255,255,255,.1)",minimumWidth:65},timeScale:{timeVisible:interval!=="1d",secondsVisible:false,borderColor:"rgba(255,255,255,.1)"}});
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
    const current=instance.current;if(!current)return;
    const ids=new Set(markers.map(m=>m.id));
    const move=(event:MouseEventParams<Time>)=>{
      const id=event.hoveredInfo?.objectId;
      const next=event.point&&typeof id==="string"&&ids.has(id)?{id,markers}:null;
      setHover(previous=>previous?.id===next?.id&&previous?.markers===next?.markers?previous:next);
    };
    current.markers.setMarkers(markers);
    current.chart.subscribeCrosshairMove(move);
    return()=>current.chart.unsubscribeCrosshairMove(move);
  },[markers]);
  useEffect(()=>{
    const current=instance.current,node=periodRef.current,container=ref.current;if(!current||!node||!container)return;
    let frame=0;
    const update=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        node.style.opacity="0";
        if(!focused)return;
        const period=tradeChartPeriod(candles,focused,interval);if(!period)return;
        const scale=current.chart.timeScale(),entryX=scale.timeToCoordinate(period.entry as Time),exitX=scale.timeToCoordinate(period.exit as Time);
        if(entryX===null||exitX===null)return;
        const bounds=visibleTradePeriod(entryX,exitX,scale.width(),scale.options().barSpacing);if(!bounds)return;
        node.style.left=`${bounds.left}px`;node.style.width=`${bounds.width}px`;node.style.height=`${current.chart.panes()[0]?.getHeight()??0}px`;node.style.opacity="1";
      });
    };
    const scale=current.chart.timeScale(),resize=new ResizeObserver(update);
    scale.subscribeVisibleLogicalRangeChange(update);scale.subscribeSizeChange(update);resize.observe(container);update();
    return()=>{cancelAnimationFrame(frame);resize.disconnect();scale.unsubscribeVisibleLogicalRangeChange(update);scale.unsubscribeSizeChange(update);};
  },[candles,focused,interval]);
  useEffect(()=>{
    const current=instance.current;if(!current)return;
    for(const [series,price] of [[current.target,levels?.targetPrice],[current.invalidation,levels?.invalidationPrice]] as const) {
      const visible=showLevels&&levels?.symbol===symbol&&price!=null;
      series.applyOptions({visible});
      series.setData(visible&&candles.length?[{time:candles[0].time as Time,value:price},{time:candles.at(-1)!.time as Time,value:price}]:[]);
    }
  },[candles,symbol,levels,showLevels]);
  const stamp=(at:string)=>new Date(at).toLocaleString("en-GB",{timeZone:"UTC",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})+" GMT";
  return <><div className="relative">
    <div ref={ref} data-idea-chart role="img" aria-label={`${symbol} ${interval} reference chart with green buy arrows, red sell arrows and trade periods. Hover an arrow or locate a trade to inspect its fills.`} className="h-80 w-full min-w-0 sm:h-[380px]"/>
    <div ref={periodRef} data-trade-period data-trade-id={focused?.id} aria-hidden="true" className="pointer-events-none absolute top-0 z-[1] border-x border-[#ff8b52]/60 bg-[#ff8b52]/10" style={{opacity:0}}/>
    {focused&&<div role="tooltip" data-trade-tooltip className="pointer-events-none absolute left-2 top-2 z-10 w-64 max-w-[calc(100%_-_1rem)] rounded-lg border border-white/20 bg-[#09090b]/95 p-3 text-[11px] leading-5 text-zinc-300 shadow-xl shadow-black/50">
      <p className="text-xs font-medium text-zinc-100">Trade {trades.indexOf(focused)+1} · {symbol} · {focused.direction}</p>
      <p className="mt-1"><span className={executionSide(focused.direction,true)==="buy"?"text-green-400":"text-red-400"}>{executionSide(focused.direction,true)==="buy"?"Buy":"Sell"} · Entry</span> {focused.entryPrice.toLocaleString("en-AU")}<br/><span className="text-zinc-500">{stamp(focused.openedAt)}</span></p>
      <p className="mt-1"><span className={executionSide(focused.direction,false)==="buy"?"text-green-400":"text-red-400"}>{executionSide(focused.direction,false)==="buy"?"Buy":"Sell"} · Exit</span> {focused.exitPrice.toLocaleString("en-AU")}<br/><span className="text-zinc-500">{stamp(focused.closedAt)}</span></p>
      <p className="mt-2 border-t border-white/10 pt-1">Result <span className={focused.resultR<0?"text-rose-300":"text-green-300"}>{signedR(focused.resultR)}</span></p>
      {!tradeChartPeriod(candles,focused,interval)&&<p className="mt-1 text-zinc-500">Part of this trade is outside available candles; its period is not shaded.</p>}
    </div>}
  </div><p className="border-t border-white/[.06] px-4 py-2 text-[10px] leading-5 text-zinc-500">{market.source==="binance"?"Binance":"Bybit"} {symbol} · {interval==="1d"?"Daily":interval.toUpperCase()} reference candles. Green ↑ buy · red ↓ sell. Hover an arrow to see the trade and its holding period; use Locate on chart on touch screens. Reference candles can differ from recorded fills.</p></>;
}
