"use client";

import { useState } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import { SiSubstack } from "react-icons/si";
import type { PublicPortfolio } from "@/lib/btc-portfolio/schema";
import { date, metrics, pct, periodPoints, portfolioYears, PORTFOLIO_TIME_ZONE } from "@/lib/btc-portfolio/view";
import type { PortfolioFreshness } from "@/lib/btc-portfolio/refresh";
import { SpotPerformanceChart } from "@/Components/spot/SpotCharts";
import PortfolioIdeas from "./PortfolioIdeas";
import PortfolioAllocation from "./PortfolioAllocation";
import PortfolioRefreshIndicator, { portfolioUpdateTime } from "./PortfolioRefreshIndicator";
import PortfolioSelect from "./PortfolioSelect";

function SubstackLink() {
  return <a href="https://thomasjohnston.substack.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2.5 rounded-lg bg-[var(--bp-accent)] px-5 py-3 text-sm font-semibold text-black transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff8b52] sm:w-auto">
    <SiSubstack aria-hidden="true" className="h-4 w-4"/>Read on Substack<FiArrowUpRight aria-hidden="true" className="h-4 w-4"/>
  </a>;
}

export default function PortfolioDashboard({ data, preview = false, freshness }: { data: PublicPortfolio; preview?: boolean; freshness?: PortfolioFreshness }) {
  const [basis, setBasis] = useState<"USD" | "COMPARE">("USD");
  const [period, setPeriod] = useState("YTD");
  const [from, setFrom] = useState(data.inceptionAt.slice(0, 10)), [to, setTo] = useState(data.asOf.slice(0, 10));
  const points = periodPoints(data, period, from, to), m = metrics(points);
  const comparing = basis === "COMPARE", returnValue = comparing ? m?.difference : m?.portfolio;
  const negativeReturn = returnValue !== undefined && returnValue < -.005;
  const years = portfolioYears(data);
  const includesHistorical = Boolean(data.history && points.some(point => point.at < data.history!.currentInceptionAt));
  const includesCurrent = !data.history || points.some(point => point.at >= data.history!.currentInceptionAt);
  const coverage = [includesHistorical ? "Spot and perpetual trades" : "", includesCurrent ? "Spot holdings and closed prop trades" : ""].filter(Boolean).join(" · ");
  return <div className="space-y-7 sm:space-y-10">
    <section aria-label="Portfolio performance" className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]">
      {freshness && <PortfolioRefreshIndicator freshness={freshness}/>}
      <div className="flex min-w-0 flex-col justify-between gap-5 px-4 pb-2 pt-5 sm:px-7 lg:flex-row">
        <div className="min-w-0">
          <div role="group" aria-label="Performance view" className="mb-4 inline-flex gap-1 rounded-lg border border-white/10 p-1">
            {(["USD", "COMPARE"] as const).map(value => <button key={value} type="button" aria-label={value === "USD" ? `View performance in ${data.currency}` : "Compare with Bitcoin"} aria-pressed={basis === value} onClick={() => setBasis(value)} className={`min-h-11 min-w-20 rounded-md px-4 text-xs font-medium ${basis === value ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}>{value === "USD" ? data.currency : "vs BTC"}</button>)}
          </div>
          <p className="text-[11px] leading-5 text-zinc-400">{comparing ? "Outperformance vs BTC" : `Portfolio return · ${data.currency}`}<span className="mx-1.5 text-zinc-700">/</span>{period === "YTD" ? "Year to date" : period === "ALL" ? "Since inception" : period.startsWith("YEAR:") ? period.slice(5) : period === "CUSTOM" ? "Custom" : period}</p>
          <p title={comparing ? "Portfolio return minus Bitcoin return." : undefined} className={`mt-1 text-[48px] font-medium leading-tight tracking-[-.055em] tabular-nums sm:text-[64px] ${negativeReturn ? "text-rose-300" : comparing ? "text-[#ff8b52]" : "text-[#7ad9b6]"}`}>{returnValue !== undefined ? pct(returnValue) : "—"}</p>
          {comparing && <>
            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">{[[`Portfolio · ${data.currency}`, m?.portfolio], [`100% BTC hold · ${data.currency}`, m?.btc]].map(([label, value]) => <div key={label}><p className="text-[11px] leading-5 text-zinc-400">{label}</p><p className="mt-1 text-lg tabular-nums text-zinc-200 sm:text-xl">{typeof value === "number" ? pct(value) : "—"}</p></div>)}</div>
            <p className="mt-3 max-w-xl text-xs leading-5 text-zinc-500">Both lines show USD returns. The gap is portfolio return minus BTC return.</p>
          </>}
        </div>
        <div role="group" aria-label="Performance period" className="grid w-full min-w-0 grid-cols-[repeat(4,minmax(0,1fr))_minmax(88px,1.4fr)] gap-1 self-start sm:w-auto sm:grid-cols-[repeat(4,auto)_96px]">
          {["YTD", "1M", "3M", "ALL"].map(p => <button key={p} type="button" aria-pressed={period === p} className={`min-h-11 min-w-0 rounded-lg px-1.5 text-xs sm:px-3 ${period === p ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"}`} onClick={() => setPeriod(p)}>{p === "ALL" ? "All" : p}</button>)}
          <PortfolioSelect quiet label="More performance periods" value={["6M", "1Y", "CUSTOM"].includes(period) || period.startsWith("YEAR:") ? period : ""} onChange={e => setPeriod(e.target.value)}>
            <option value="" disabled>More</option><optgroup label="Years">{years.map(year => <option key={year} value={`YEAR:${year}`}>{year}</option>)}</optgroup><optgroup label="Other periods"><option value="6M">6 mo</option><option value="1Y">1 year</option><option value="CUSTOM">Custom</option></optgroup>
          </PortfolioSelect>
        </div>
      </div>
      {period === "CUSTOM" && <div className="grid min-w-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 text-xs text-zinc-400 sm:px-7">{[["From", from, setFrom], ["To", to, setTo]].map(([label, value, change]) => <label key={label as string} className="min-w-0">{label as string}<input aria-label={label === "From" ? "Start date" : "End date"} type="date" value={value as string} max={label === "From" ? to : undefined} min={label === "To" ? from : undefined} onChange={e => (change as (v: string) => void)(e.target.value)} className="mt-2 block min-h-11 w-full min-w-0 max-w-full appearance-none rounded-lg border border-white/10 bg-[#101013] px-2 text-base text-zinc-200 sm:text-xs"/></label>)}</div>}
      <SpotPerformanceChart showOptions={false} key={`${basis}-${period}-${from}-${to}`} points={points} activity={[]} timeZone={PORTFOLIO_TIME_ZONE} comparison={comparing ? "usd-comparison" : "usd"} quoteCurrency={data.currency} costLabel="UTC"/>
      {comparing && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] px-4 py-4 sm:px-7"><p className="text-xs text-zinc-400" title="Change in how much Bitcoin the portfolio can buy.">BTC purchasing power</p><p className="text-lg tabular-nums text-zinc-200">{m ? pct(m.relative) : "—"}</p></div>}
      {points.length > 0 && <p className="border-t border-white/[.07] px-4 py-3 text-[10px] leading-5 text-zinc-500 sm:px-7">{coverage}</p>}
    </section>
    <p className="!mt-3 text-center text-[10px] leading-5 text-zinc-500">{preview ? "Private preview · " : ""}Valued <time dateTime={data.asOf}>{date(data.asOf)} · {portfolioUpdateTime(data.asOf)}</time></p>
    <div className="grid min-w-0 items-start gap-7 sm:gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-6">
      <PortfolioAllocation data={data} livePrices={!preview}/>
      <PortfolioIdeas ideas={data.stories?.ideas ?? []} notes={data.editorialNotes ?? []}/>
    </div>
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/[.08] p-5 sm:flex-row sm:items-center sm:p-6"><p className="text-base font-medium text-zinc-200">Get new ideas on Substack.</p><SubstackLink/></div>
  </div>;
}
