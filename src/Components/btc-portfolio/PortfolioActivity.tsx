"use client";

import { useState } from "react";
import type { PublicPortfolio } from "@/lib/btc-portfolio/schema";
import { activityAllocationChanges, date, pct, portfolioActivityView } from "@/lib/btc-portfolio/view";
import AssetLogo from "@/Components/spot/AssetLogo";

const PAGE_SIZE = 8;
const compactChange = (value: number) => `${value > 0 ? "+" : ""}${new Intl.NumberFormat("en-AU", { maximumFractionDigits: Math.abs(value) < .1 ? 2 : 1 }).format(value)}%`;
const labels: Record<PublicPortfolio["activity"][number]["kind"], string> = {
  opening: "Opening", buy: "Buy", sell: "Sell", transfer: "Transfer", deposit: "Deposit", withdrawal: "Withdrawal", "margin-open": "Margin open", "margin-close": "Margin close", fee: "Fee",
};

export default function PortfolioActivity({ activity, first, last }: { activity: PublicPortfolio["activity"]; first?: string; last?: string }) {
  const [asset, setAsset] = useState(""), [limit, setLimit] = useState(PAGE_SIZE);
  const { availableAssets, selectedAsset, groups } = portfolioActivityView(activity, first, last, asset);
  const shown = Math.min(limit, groups.length);
  return <section aria-labelledby="decisions-title" className="min-w-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-white/[.08] lg:bg-[#0a0a0c]">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 lg:mb-0 lg:border-b lg:border-white/[.06] lg:px-5 lg:py-3">
      <div className="lg:flex lg:items-baseline lg:gap-3"><h2 id="decisions-title" className="text-lg font-medium text-zinc-200">Activity & decisions</h2><p className="mt-1 text-[11px] text-zinc-500 lg:mt-0">{groups.length} {groups.length === 1 ? "decision" : "decisions"}</p></div>
      <select aria-label="Filter activity by asset" className="min-h-11 max-w-40 rounded-lg border border-white/10 bg-[#09090b] px-3 text-xs text-zinc-300" value={selectedAsset} onChange={event => { setAsset(event.target.value); setLimit(PAGE_SIZE); }}>
        <option value="">All assets</option>{availableAssets.map(value => <option key={value} value={value}>{value === "USD" || value === "USDT" ? `Cash (${value})` : value}</option>)}
      </select>
    </div>
    <div className="overflow-hidden rounded-xl border border-white/[.08] bg-[#0a0a0c] lg:rounded-none lg:border-0">
      <div aria-hidden="true" className="hidden grid-cols-[100px_170px_minmax(0,1fr)_16px] gap-3 border-b border-white/[.07] px-4 py-2 text-[10px] text-zinc-500 sm:grid"><span>Date · UTC</span><span>Activity</span><span>Allocation change</span><span/></div>
      {groups.slice(0, limit).map(group => {
        const event = group[0], changes = activityAllocationChanges(group);
        const primaryAsset = event.asset === "USD" || event.asset === "USDT" ? "CASH" : event.asset;
        const change = changes.find(change => change.asset === primaryAsset);
        return <details key={event.campaignId ? `campaign:${event.campaignId}` : `event:${event.id}`} className="group border-b border-white/[.06] last:border-0">
          <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors hover:bg-white/[.025] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#ff8b52] [&::-webkit-details-marker]:hidden sm:min-h-14 sm:grid-cols-[100px_170px_minmax(0,1fr)_16px] sm:px-4">
            <time dateTime={event.at} className="col-start-2 row-start-1 whitespace-nowrap text-[10px] tabular-nums text-zinc-500 sm:col-start-1 sm:text-[11px]">{date(event.at)}</time>
            <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 sm:col-start-2"><AssetLogo asset={event.asset} size={20}/><span className="text-xs font-medium text-zinc-200">{event.asset}</span><span className="truncate text-[11px] text-zinc-500">{group.length > 1 ? `${group.length} buys` : labels[event.kind]}</span></span>
            <span className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs font-medium tabular-nums sm:col-span-1 sm:col-start-3 sm:row-start-1">
              {change ? <span aria-label={`${event.asset} allocation change ${compactChange(change.deltaPct)}`} className={change.deltaPct > 0 ? "text-[#7ad9b6]" : "text-rose-300"}>{compactChange(change.deltaPct)}</span> : <span className="font-normal text-zinc-500">{event.kind === "transfer" ? "Custody change" : "—"}</span>}
            </span>
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="col-start-3 row-start-1 h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 sm:col-start-4"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </summary>
          <div className="border-t border-white/[.04] bg-white/[.015] px-3 pb-3 pt-2 sm:pl-[132px] sm:pr-10">
            {changes.length > 0 && <div aria-label="Allocation breakdown" className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium tabular-nums">{changes.map(change => <span key={change.asset} className={change.deltaPct > 0 ? "text-[#7ad9b6]" : "text-rose-300"}>{pct(change.deltaPct)} {change.asset === "CASH" ? "Cash" : change.asset}</span>)}</div>}
            <p className="max-w-3xl text-xs leading-5 text-zinc-400">{event.reason}</p>
            {event.articleUrl && <a href={event.articleUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center text-xs text-[#ffad83]">Read the idea on Substack ↗</a>}
          </div>
        </details>;
      })}
      {!groups.length && <p className="p-6 text-center text-xs text-zinc-500">No recorded decisions in this period.</p>}
      {groups.length > PAGE_SIZE && <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 border-t border-white/[.06] px-4 text-[11px] text-zinc-500"><span>Showing {shown} of {groups.length}</span><div className="flex gap-4">{shown > PAGE_SIZE && <button type="button" className="min-h-11 text-zinc-400 hover:text-white" onClick={() => setLimit(PAGE_SIZE)}>Show fewer</button>}{shown < groups.length && <button type="button" className="min-h-11 text-zinc-300 hover:text-white" onClick={() => setLimit(limit + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, groups.length - shown)} more ↓</button>}</div></div>}
    </div>
  </section>;
}
