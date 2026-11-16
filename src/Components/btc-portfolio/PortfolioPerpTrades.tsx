"use client";

import { useState } from "react";
import type { PortfolioPerpTrade } from "@/lib/btc-portfolio/stories";
import { activityDateTime } from "@/lib/journal/activity-view";
import { date } from "@/lib/btc-portfolio/view";

export default function PortfolioPerpTrades({ trades }: { trades: PortfolioPerpTrade[] }) {
  const [year, setYear] = useState(""), [asset, setAsset] = useState(""), [limit, setLimit] = useState(20);
  const assets = [...new Set(trades.filter(t => !year || (t.openedAt ?? t.closedAt!).startsWith(year)).map(t => t.asset))].sort(), years = [...new Set(trades.map(t => (t.openedAt ?? t.closedAt!).slice(0, 4)))].sort().reverse();
  const filtered = trades.filter(t => (!year || (t.openedAt ?? t.closedAt!).startsWith(year)) && (!asset || t.asset === asset)).sort((a, b) => (b.openedAt ?? b.closedAt!).localeCompare(a.openedAt ?? a.closedAt!) || b.id.localeCompare(a.id));
  const select = "min-h-11 rounded-lg border border-white/10 bg-[#0a0a0c] px-3 text-xs text-zinc-400";
  const stamp = (value: string | null, opening = false) => value ? <time dateTime={value} title={activityDateTime(value)}>{date(value)}</time> : <span className="text-zinc-600">{opening ? "Before record" : "Open"}</span>;
  return <details id="perp-trades" className="overflow-hidden rounded-xl border border-white/[.08] bg-[#0a0a0c]">
    <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-5 text-zinc-200 marker:hidden sm:px-7"><span><span className="block text-lg font-medium">Perp trade history</span><span className="mt-1 block text-[11px] font-normal text-zinc-500">Optional historical detail</span></span><span aria-hidden className="text-zinc-500">⌄</span></summary>
    {trades.length ? <>
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[.06] p-5 sm:px-7"><div><h2 id="perp-trades-title" className="text-lg font-medium text-zinc-200">Perp trades</h2><p className="mt-2 text-[11px] text-zinc-500">Crypto trades · All dates UTC</p></div><div className="flex flex-wrap items-center gap-2"><span className="mr-2 text-[11px] text-zinc-500">{filtered.length} trades</span><select aria-label="Filter perp trades by year" className={select} value={year} onChange={e => { setYear(e.target.value); setAsset(""); setLimit(20); }}><option value="">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select><select aria-label="Filter perp trades by asset" className={select} value={asset} onChange={e => { setAsset(e.target.value); setLimit(20); }}><option value="">All assets</option>{assets.map(a => <option key={a}>{a}</option>)}</select></div></div>
    <table className="w-full table-fixed text-left text-[11px] sm:text-xs"><thead><tr className="border-b border-white/[.06] text-[10px] text-zinc-500"><th className="w-[22%] px-3 py-3 font-normal sm:px-7">Asset</th><th className="w-[18%] py-3 font-normal">Side</th><th className="w-[30%] py-3 font-normal">Opened · UTC</th><th className="w-[30%] py-3 pr-3 font-normal sm:pr-7">Closed · UTC</th></tr></thead><tbody>{filtered.slice(0, limit).map(trade => <tr key={trade.id} className="border-b border-white/[.04] last:border-0"><td className="break-words px-3 py-3.5 font-medium text-zinc-200 sm:px-7">{trade.asset}</td><td className={`py-3.5 text-[10px] ${trade.direction === "LONG" ? "text-emerald-200/80" : "text-rose-300/80"}`}>{trade.direction}</td><td className="py-3.5 pr-2 tabular-nums text-zinc-400">{stamp(trade.openedAt, true)}</td><td className="py-3.5 pr-3 tabular-nums text-zinc-400 sm:pr-7">{stamp(trade.closedAt)}</td></tr>)}</tbody></table>
    {!filtered.length && <p className="p-7 text-sm text-zinc-500">No trades for this selection.</p>}
    {filtered.length > limit && <button type="button" className="min-h-12 w-full border-t border-white/[.06] text-xs text-zinc-400 hover:bg-white/[.03]" onClick={() => setLimit(limit + 30)}>Show 30 more trades</button>}
    </> : <p className="border-t border-white/[.06] px-5 py-5 text-xs leading-6 text-zinc-500 sm:px-7">Trade-level records are kept private. Portfolio performance includes the recorded trading results.</p>}
  </details>;
}
