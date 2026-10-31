"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicIdeaView } from "@/lib/performance/public-record";
import { ideaChartWindow, ideaMarkets, ideaMarketTrades } from "@/lib/performance/idea-timeline";
import { calculateStats, signedR } from "@/lib/performance/metrics";
import { displayPerformanceSymbol, type PerformanceTrade, type TradeCandleInterval } from "@/lib/performance/types";
import { ideaMarketLevels } from "@/lib/performance/idea-timeline-model";
import IdeaPriceChart from "./IdeaPriceChart";
import DiscordCTA from "./DiscordCTA";
const panel="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#09090b]";
const button="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-3 text-xs text-zinc-300 hover:bg-white/5";
const date=(v:string)=>new Date(v).toLocaleDateString("en-AU",{timeZone:"Australia/Melbourne",day:"numeric",month:"short",year:"numeric"});

export default function PublicIdeaDetail({idea,exampleTrades=[]}:{idea:PublicIdeaView;exampleTrades?:PerformanceTrade[]}) {
  const demonstration=exampleTrades.length>0;
  const record=demonstration?exampleTrades:idea.trades;
  const markets=useMemo(()=>ideaMarkets(idea,record),[idea,record]);
  const [symbol,setSymbol]=useState(markets[0]??""),[selectedTrade,setSelectedTrade]=useState(""),[showTrades,setShowTrades]=useState(true),[showLevels,setShowLevels]=useState(true),[limit,setLimit]=useState(10),[interval,setInterval]=useState<TradeCandleInterval>("4h");
  const trades=useMemo(()=>ideaMarketTrades(record,symbol),[record,symbol]);
  const current=useMemo(()=>[{id:"current",at:idea.ideaAt,publishedAt:idea.firstPublishedAt,title:idea.title,thesis:idea.thesis,target:idea.target,invalidation:idea.invalidation,chart:idea.chart}],[idea]);
  const [chartNow]=useState(()=>Date.now());
  const selected=trades.find(t=>t.id===selectedTrade);
  // Keep the requested date window fixed while readers toggle overlays or expand text.
  const window=useMemo(()=>ideaChartWindow(current,trades,idea.ideaAt,selected,chartNow,interval),[current,trades,idea.ideaAt,selected,chartNow,interval]);
  const stats=calculateStats(record);
  function locate(trade:PerformanceTrade){setSymbol(trade.symbol);setSelectedTrade(trade.id);setShowTrades(true);}
  return <div className="space-y-5">
    {demonstration&&<aside aria-label="Staging demonstration" className="rounded-xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100/80">Staging demonstration · These are fictional sample trades for previewing the chart and layout. They are excluded from journal performance and are not account executions.</aside>}
    <section className={`${panel} grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]`} aria-label="Idea thesis">
      <div><h2 className="text-sm font-medium text-zinc-200">Thesis</h2><p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-6 text-zinc-300">{idea.thesis.length<=650?idea.thesis:`${idea.thesis.slice(0,650)}…`}</p>{idea.thesis.length>650&&<details className="mt-2"><summary className="min-h-11 cursor-pointer text-xs text-[#ffad83]">Read more</summary><p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-zinc-300">{idea.thesis.slice(650)}</p></details>}</div>
      {[["Target / scenario",idea.target],["Invalidation",idea.invalidation]].map(([label,text])=><div key={label}><h2 className="text-sm font-medium text-zinc-200">{label}</h2><p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-6 text-zinc-400">{text||"Not supplied."}</p></div>)}
    </section>
    {symbol&&<section className={panel} aria-label="Idea chart and controls"><header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-white/10 px-4 py-3"><div className="flex flex-wrap items-center gap-3"><h2 className="text-sm font-medium">Chart</h2><label className="text-xs text-zinc-500">Market<select aria-label="Idea chart market" className="ml-2 min-h-11 max-w-full rounded-lg border border-white/15 bg-black px-3 text-xs text-zinc-300" value={symbol} onChange={e=>{setSymbol(e.target.value);setSelectedTrade("");setLimit(10);}}>{markets.map(m=><option key={m}>{m}</option>)}</select></label><nav aria-label="Idea chart timeframe" className="flex flex-wrap gap-1">{([["1h","1h"],["4h","4h"],["1d","Daily"]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={interval===value} onClick={()=>setInterval(value)} className={`${button} ${interval===value?"border-[#ff6719]/40 bg-[#ff6719]/10 !text-[#ffad83]":""}`}>{label}</button>)}</nav></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-400"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={showTrades} onChange={e=>setShowTrades(e.target.checked)}/>Trades</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={showLevels} onChange={e=>setShowLevels(e.target.checked)}/>Target / invalidation</label></div>{selected&&<button type="button" className={button} onClick={()=>setSelectedTrade("")}>Show all trades</button>}</header>
      <IdeaPriceChart key={`${symbol}:${window.start}:${window.end}:${window.interval}`} symbol={symbol} {...window} levels={ideaMarketLevels(idea,symbol)} trades={trades} selectedTrade={selectedTrade} showTrades={showTrades} showLevels={showLevels}/>
      {window.clipped&&<p className="border-t border-white/10 px-4 py-2 text-[11px] leading-5 text-zinc-500">Showing a bounded date range. Select a trade below to focus its entry and exit.</p>}
    </section>}
    <section className={panel} aria-label="Published trade attempts"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4"><div><h2 className="text-sm font-medium">Trades{symbol?` · ${symbol}`:""}</h2><p className="mt-1 text-[11px] text-zinc-500">{trades.length} {demonstration?"sample":"closed"} trade{trades.length===1?"":"s"} · earliest entry first</p></div><p className="text-xs text-zinc-500">{demonstration?"Sample results":"All markets"} · {stats.tradeCount} closed · <span className={`text-base tabular-nums ${stats.totalR<0?"text-rose-300":"text-[#ffad83]"}`}>{stats.tradeCount?signedR(stats.totalR):"No results yet"}</span></p></header>
      {trades.slice(0,limit).map((t,index)=><article key={t.id} className={`flex flex-wrap items-center justify-between gap-4 border-b border-white/[.07] p-4 last:border-0 ${selectedTrade===t.id?"bg-[#ff6719]/5":""}`}>
        <Link href={`/performance/trades/${t.id}`} aria-label={`View trade ${index+1}: ${displayPerformanceSymbol(t)} ${t.direction}`} className="group flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-lg py-2 focus-visible:outline focus-visible:outline-[#ff8b52]">
          <div className="min-w-0 flex-1"><p className="text-[13px] text-zinc-200 group-hover:text-[#ffad83]">Trade {index+1} · {displayPerformanceSymbol(t)} · {t.direction} <span aria-hidden="true">↗</span></p><p className="mt-1 text-xs leading-5 text-zinc-500">{date(t.openedAt)} → {date(t.closedAt)} · {t.entryPrice.toLocaleString("en-AU")} → {t.exitPrice.toLocaleString("en-AU")}</p>{t.description&&<p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-xs leading-5 text-zinc-400">{t.description.length>240?`${t.description.slice(0,240)}…`:t.description}</p>}</div>
          <span className={`shrink-0 text-sm tabular-nums ${t.resultR<0?"text-rose-300":"text-[#ffad83]"}`}>{signedR(t.resultR)}</span>
        </Link><button type="button" className={button} aria-pressed={selectedTrade===t.id} onClick={()=>locate(t)}>Locate on chart</button>
      </article>)}
      {!trades.length&&<p className="p-4 text-xs text-zinc-500">No published closed trades{symbol?" in this market":""} yet.</p>}{trades.length>limit&&<button className={`${button} m-4`} type="button" onClick={()=>setLimit(limit+10)}>Show more trades</button>}
    </section>
    {idea.articleUrl&&<a href={idea.articleUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs text-[#ffad83]">Read the analysis ↗</a>}
    <section className={panel}><DiscordCTA placement="idea_detail"/></section>
    <p className="text-[11px] leading-5 text-zinc-600">Analysis and completed trades. Idea dates do not establish prior public availability. Targets and invalidation are stated conditions; price touches do not change the idea’s outcome automatically. Past results do not promise future performance.</p>
  </div>;
}
