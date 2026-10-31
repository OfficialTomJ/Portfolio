"use client";
import { useEffect, useState } from "react";
import TradePriceChart from "./TradePriceChart";
import type { MarketCandles, PerformanceTrade, TradeCandleInterval } from "@/lib/performance/types";

export default function PrivateReviewChart({trade}:{trade:PerformanceTrade}) {
  const [market,setMarket]=useState<MarketCandles|null>(null),[error,setError]=useState("");
  const interval:TradeCandleInterval=Date.parse(trade.closedAt)-Date.parse(trade.openedAt)>70*86400000?"1d":"4h";
  useEffect(()=>{
    const controller=new AbortController(),step=interval==="1d"?86400:14400;
    const start=Math.floor(Date.parse(trade.openedAt)/1000)-12*step,end=Math.ceil(Date.parse(trade.closedAt)/1000)+12*step;
    if(end-start>480*step)return;
    const query=new URLSearchParams({symbol:trade.symbol,interval,direction:"window",start:String(start),end:String(end)});
    fetch(`/api/performance/market?${query}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error("Market chart is temporarily unavailable.");const data=await r.json() as MarketCandles;if(!data.candles?.length)throw Error("No reference candles available.");setMarket(data);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[trade,interval]);
  if(Date.parse(trade.closedAt)-Date.parse(trade.openedAt)>450*86400000)return <p className="text-xs text-zinc-500">This trade exceeds the available chart window. Its recorded facts remain available for private review.</p>;
  return market?<TradePriceChart trade={trade} candles={market.candles} source={market.source} initialInterval={interval}/>:<p role="status" className="py-8 text-center text-xs text-zinc-500">{error||"Loading reference chart…"}</p>;
}
