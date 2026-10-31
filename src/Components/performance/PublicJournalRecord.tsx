"use client";

import Link from "next/link";
import { useState } from "react";
import { signedR } from "@/lib/performance/metrics";
import { displayPerformanceSymbol, type PerformanceTrade } from "@/lib/performance/types";
import { groupPublicRecord, ideaExcerpt, type PublicIdeaView } from "@/lib/performance/public-record";
import { track } from "@/lib/track";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric",
});

function TradeRows({ trades, period, ideas = [] }: {
  trades: PerformanceTrade[]; period: string; ideas?: PublicIdeaView[];
}) {
  return <>{trades.map(trade => {
    const idea = ideas.find(item => item.trades.some(linked => linked.id === trade.id));
    return <article key={trade.id} className="border-b border-white/[0.07] last:border-0">
      <Link
        href={`/performance/trades/${trade.id}`}
        onClick={() => track("performance_trade_open", { direction: trade.direction.toLowerCase(), period })}
        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition-colors hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-[#ff6719] sm:px-6"
      >
        <div className="min-w-0">
          <p className="break-words font-medium leading-5 text-zinc-100">{displayPerformanceSymbol(trade)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] ${trade.direction === "Long" ? "border-[#22c55e]/35 bg-[#22c55e]/[0.10] text-[#22c55e]" : "border-[#ef4444]/35 bg-[#ef4444]/[0.10] text-[#ef4444]"}`}>
              {trade.direction.toUpperCase()} {trade.direction === "Long" ? "↑" : "↓"}
            </span>
            <span className="text-xs text-zinc-500">{dateFormatter.format(new Date(trade.closedAt))}</span>
            {trade.tradeType && <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">{trade.tradeType}</span>}
          </div>
        </div>
        <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${trade.resultR >= 0 ? "text-[var(--bp-accent)]" : "text-zinc-300"}`}>
          {signedR(trade.resultR)}
        </span>
      </Link>
      {idea && <Link href={`/performance/ideas/${idea.id}`} onClick={() => track("performance_idea_open", { placement: "trade_history" })} className="mx-4 mb-4 block truncate text-xs text-zinc-500 hover:text-[#ffad83] sm:mx-6">Idea: {idea.title} ↗</Link>}
    </article>;
  })}</>;
}

function IdeaRow({ idea, trades, period }: { idea: PublicIdeaView; trades: PerformanceTrade[]; period: string }) {
  const result = trades.reduce((sum, trade) => sum + trade.resultR, 0);
  return <details className="group border-b border-white/[0.08] last:border-0">
    <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-5 transition-colors hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-[#ff6719] sm:px-6 [&::-webkit-details-marker]:hidden">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500">
          <span className={`rounded border px-1.5 py-0.5 capitalize ${idea.status === "active" ? "border-[#ff6719]/25 text-[#ffad83]" : "border-white/10"}`}>{idea.status}</span>
          <span>Idea · {dateFormatter.format(new Date(idea.ideaAt))}</span>
        </div>
        <h3 className="mt-2 break-words text-base font-medium leading-6 text-zinc-100">{idea.title}</h3>
        <p className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-zinc-400 group-open:hidden">{ideaExcerpt(idea.thesis)}</p>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span>{trades.length} closed trade{trades.length === 1 ? "" : "s"}</span>
          {trades.length > 0 && <span className={`font-semibold tabular-nums ${result >= 0 ? "text-[var(--bp-accent)]" : "text-zinc-300"}`}>{signedR(result)}</span>}
          <span className="text-[10px] text-zinc-600 group-open:hidden">Expand to explore</span>
        </p>
      </div>
      <span aria-hidden className="mt-1 text-zinc-500 transition-transform group-open:rotate-180">⌄</span>
    </summary>
    <div className="border-t border-white/[0.06] bg-white/[0.015]">
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <p className="line-clamp-4 break-words text-sm leading-6 text-zinc-300">{ideaExcerpt(idea.thesis, 360)}</p>
        <Link href={`/performance/ideas/${idea.id}`} onClick={() => track("performance_idea_open", { placement: "journal" })} className="inline-flex min-h-11 items-center text-xs font-medium text-[#ffad83] hover:text-white">Read full idea &amp; context ↗</Link>
        <p className="text-[10px] leading-5 text-zinc-600">First published {dateFormatter.format(new Date(idea.firstPublishedAt))}. Trade results below follow your selected period and filters.</p>
      </div>
      <div className="border-t border-white/[0.07]">
        {trades.length ? <TradeRows trades={trades} period={period} /> : <p className="px-4 py-5 text-xs text-zinc-500 sm:px-6">No published closed trades for this idea yet.</p>}
      </div>
    </div>
  </details>;
}

export default function PublicJournalRecord({ trades, ideas, period, selectedDateLabel, onClearDay }: {
  trades: PerformanceTrade[]; ideas: PublicIdeaView[]; period: string;
  selectedDateLabel: string | null; onClearDay: () => void;
}) {
  const [mode, setMode] = useState<"ideas" | "trades">(ideas.length ? "ideas" : "trades");
  const [ideaLimit, setIdeaLimit] = useState(6);
  const { groups, ungrouped } = groupPublicRecord(ideas, trades, Boolean(selectedDateLabel));
  return <section aria-label="Ideas and closed trades" className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07090d] md:max-h-[650px] md:min-h-[520px]">
    <div className="space-y-4 border-b border-white/[0.08] px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-medium">Ideas &amp; trades</h2><p className="mt-1 text-xs text-zinc-500">{trades.length} closed trade{trades.length === 1 ? "" : "s"}{selectedDateLabel ? ` · ${selectedDateLabel}` : " · selected period"}</p></div>
        {selectedDateLabel && <button type="button" onClick={onClearDay} className="min-h-11 text-xs text-zinc-400 hover:text-white">Clear day</button>}
      </div>
      <div className="flex gap-1 rounded-lg border border-white/[0.08] p-1" role="group" aria-label="Record view">
        {([ ["ideas", "By idea"], ["trades", "All trades"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-10 flex-1 rounded-md px-3 text-xs transition-colors ${mode === value ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-white"}`}>{label}</button>)}
      </div>
      <p className="text-[11px] leading-5 text-zinc-500">{mode === "ideas" ? "Expand an idea for its context and trades. Results follow the selected period and filters." : "Newest first. Select a trade for its chart and details."}</p>
    </div>
    <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
      {mode === "ideas" ? <>
        {groups.slice(0, ideaLimit).map(group => <IdeaRow key={group.idea.id} {...group} period={period} />)}
        {groups.length > ideaLimit && <button type="button" onClick={() => setIdeaLimit(ideaLimit + 6)} className="m-4 min-h-11 rounded-lg border border-white/10 px-4 text-xs text-zinc-400 hover:text-white">Show more ideas</button>}
        {!groups.length && <p className="px-4 py-6 text-sm leading-6 text-zinc-500 sm:px-6">{ideas.length ? "No published ideas have closed trades in this selection." : "Published idea write-ups will appear here. The closed trade record is available below."}</p>}
        {ungrouped.length > 0 && <div className="border-t border-white/[0.08]"><h3 className="px-4 pb-1 pt-5 text-xs font-medium text-zinc-400 sm:px-6">{groups.length ? "Other closed trades" : "Closed trades"}</h3><p className="px-4 pb-2 text-[11px] text-zinc-600 sm:px-6">No published idea linked yet.</p><TradeRows trades={ungrouped} period={period} /></div>}
      </> : <TradeRows trades={trades} period={period} ideas={ideas} />}
      {!trades.length && (mode === "trades" || !groups.length) && <div className="px-5 py-10 text-center"><p className="text-sm text-zinc-400">No closed trades {selectedDateLabel ? `on ${selectedDateLabel}` : "in this period"}.</p><p className="mt-2 text-xs text-zinc-600">Choose another date or period.</p></div>}
    </div>
  </section>;
}
