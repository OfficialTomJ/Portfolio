"use client";

import { useState } from "react";
import { BsPinAngleFill } from "react-icons/bs";
import { FiArrowUpRight, FiLayers } from "react-icons/fi";
import PortfolioSelect from "./PortfolioSelect";
import type { PortfolioEditorialNote, PortfolioIdea } from "@/lib/btc-portfolio/stories";
import { date } from "@/lib/btc-portfolio/view";
import AssetLogo from "@/Components/spot/AssetLogo";

function periodLabel(period: string, end?: string) {
  if (period.length === 4) return end && end !== period ? `${period}–${end}` : period;
  const format = (value: string, year = true) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", ...(year ? { year: "numeric" as const } : {}) }).format(new Date(`${value}-01T00:00:00Z`));
  if (!end || end === period) return format(period);
  return period.slice(0, 4) === end.slice(0, 4) ? `${format(period, false)}–${format(end)}` : `${format(period)} – ${format(end)}`;
}

export default function PortfolioIdeas({ ideas, notes = [], initialYear = "", headingId = "portfolio-ideas-title" }: { ideas: PortfolioIdea[]; notes?: PortfolioEditorialNote[]; historicalYear?: number; initialYear?: string; headingId?: string }) {
  const [asset, setAsset] = useState(""), [year, setYear] = useState(initialYear), [limit, setLimit] = useState(4);
  const entries = [
    ...ideas.map(idea => ({ id: idea.id, asset: idea.asset, year: idea.at.slice(0, 4), sort: idea.at, label: date(idea.at), title: idea.title, reason: idea.reason, detail: undefined as string | undefined, articleUrl: idea.articleUrl, awaitingArticle: idea.articleStatus === "awaiting-publication", direction: idea.direction as string, isNote: false, pinned: false })),
    ...notes.map(note => ({ id: note.id, asset: note.asset, year: note.period.slice(0, 4), sort: note.period, label: periodLabel(note.period, note.periodEnd), title: note.title, reason: note.reason, detail: note.detail, articleUrl: note.articleUrl, awaitingArticle: false, direction: "Portfolio note", isNote: true, pinned: Boolean(note.pinned) })),
  ];
  const assets = [...new Set(entries.filter(entry => !year || entry.year === year).map(entry => entry.asset).filter(value => value !== "PORTFOLIO"))].sort();
  const years = [...new Set(entries.map(entry => entry.year))].sort().reverse();
  const filtered = entries.filter(entry => (!asset || entry.asset === asset) && (!year || entry.year === year)).sort((a, b) => b.year.localeCompare(a.year) || Number(b.pinned) - Number(a.pinned) || b.sort.localeCompare(a.sort));
  return <section aria-labelledby={headingId} className="min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-[#0a0a0c]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.06] p-5 sm:px-7"><div><h2 id={headingId} className="text-lg font-medium text-zinc-200">Ideas & analysis</h2></div><span className="text-xs text-zinc-500">{filtered.length} {filtered.length === 1 ? "idea" : "ideas"}</span></div>
    <div className="flex flex-wrap gap-2 border-b border-white/[.06] px-5 py-3 sm:px-7"><PortfolioSelect label="Filter ideas by year" className="flex-1 sm:max-w-32" value={year} onChange={e => { setYear(e.target.value); setAsset(""); setLimit(4); }}><option value="">All years</option>{years.map(y => <option key={y}>{y}</option>)}</PortfolioSelect><PortfolioSelect label="Filter ideas by asset" className="flex-1 sm:max-w-36" value={asset} onChange={e => { setAsset(e.target.value); setLimit(4); }}><option value="">All assets</option>{assets.map(a => <option key={a} value={a}>{a === "PORTFOLIO" ? "Portfolio" : a}</option>)}</PortfolioSelect></div>
    <div className="divide-y divide-white/[.06]">{filtered.slice(0, limit).map(entry => <article key={entry.id} className={`p-5 sm:px-7 ${entry.pinned ? "bg-[#ff8b52]/[.065]" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500">{entry.asset === "PORTFOLIO" ? <FiLayers aria-hidden="true" className="h-4 w-4 shrink-0"/> : <AssetLogo asset={entry.asset} size={20}/>}<span className="text-xs text-zinc-300">{entry.asset === "PORTFOLIO" ? "Portfolio" : entry.asset}</span>{!entry.isNote && <span className={entry.direction === "SHORT" ? "text-rose-300/80" : "text-emerald-200/70"}>{entry.direction}</span>}{entry.pinned && <span role="img" aria-label="Pinned overview" title="Pinned overview" className="text-[#ffad83]"><BsPinAngleFill aria-hidden="true" className="h-3 w-3"/></span>}<span className="ml-auto whitespace-nowrap">{entry.label}</span></div>
      <h3 className="mt-3 text-sm font-medium leading-6 text-zinc-200">{entry.title}</h3><p className="mt-2 text-xs leading-6 text-zinc-400">{entry.reason}</p>{entry.detail && <p className="mt-3 text-xs leading-6 text-zinc-500">{entry.detail}</p>}
      {entry.articleUrl ? <a href={entry.articleUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 max-w-full items-center gap-2 text-xs text-[#ffad83] hover:text-white">Read on Substack<FiArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/></a> : null}
    </article>)}{!filtered.length && <p className="p-7 text-sm leading-6 text-zinc-500">No ideas for this selection.</p>}</div>
    {filtered.length > limit && <button type="button" onClick={() => setLimit(limit + 6)} className="min-h-12 w-full border-t border-white/[.06] text-xs text-zinc-400 hover:bg-white/[.03]">Show more ideas</button>}
  </section>;
}
