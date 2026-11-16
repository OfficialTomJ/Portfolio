"use client";

import { useState } from "react";
import type { PublicPortfolio } from "@/lib/btc-portfolio/schema";
import { date, metrics, pct, periodPoints, portfolioYears, PORTFOLIO_TIME_ZONE } from "@/lib/btc-portfolio/view";
import PortfolioIdeas from "./PortfolioIdeas";
import PortfolioAllocation from "./PortfolioAllocation";
import { SpotPerformanceChart } from "@/Components/spot/SpotCharts";
import { SiSubstack } from "react-icons/si";
import type { PortfolioFreshness } from "@/lib/btc-portfolio/refresh";
import PortfolioRefreshIndicator, { portfolioUpdateTime } from "./PortfolioRefreshIndicator";

function SubstackLink() {
  return <a href="https://thomasjohnston.substack.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2.5 rounded-lg bg-[var(--bp-accent)] px-6 py-3 text-sm font-semibold text-black transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff8b52] sm:w-auto"><SiSubstack aria-hidden="true" className="text-lg"/>Read on Substack<span aria-hidden="true" className="ml-1">↗</span></a>;
}

export default function PortfolioDashboard({ data, preview = false, freshness }: { data: PublicPortfolio; preview?: boolean; freshness?: PortfolioFreshness }) {
  const [basis, setBasis] = useState<"USD" | "COMPARE">("USD");
  const [period, setPeriod] = useState("YTD");
  const [from, setFrom] = useState(data.inceptionAt.slice(0, 10)), [to, setTo] = useState(data.asOf.slice(0, 10));
  const points = periodPoints(data, period, from, to), m = metrics(points);
  const comparing = basis === "COMPARE", returnValue = comparing ? m?.difference : m?.portfolio;
  const negativeReturn = returnValue !== undefined && returnValue < -.005;
  const years = portfolioYears(data);
  const historicalYear = data.history ? new Date(data.inceptionAt).getUTCFullYear() : undefined;
  const currentYear = new Date(data.history?.currentInceptionAt ?? data.asOf).getUTCFullYear();
  const includesHistorical = Boolean(data.history && points.some(point => point.at < data.history!.currentInceptionAt));
  const includesCurrent = !data.history || points.some(point => point.at >= data.history!.currentInceptionAt);
  const coverage = [includesHistorical ? `${historicalYear} includes crypto spot and perp trading results.` : "", includesCurrent ? `${currentYear} includes spot investing and recorded closed prop results.` : ""].filter(Boolean).join(" ");
  return <div className="space-y-8 sm:space-y-12">
    <section aria-label="Portfolio performance" className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]">
      {freshness && <PortfolioRefreshIndicator freshness={freshness}/>}
      <div className="flex flex-col justify-between gap-5 px-4 pb-2 pt-5 sm:px-7 lg:flex-row">
        <div><div role="group" aria-label="Performance view" className="mb-4 inline-flex gap-1 rounded-lg border border-white/10 p-1">{(["USD", "COMPARE"] as const).map(value => <button key={value} type="button" aria-label={value === "USD" ? `View performance in ${data.currency}` : "Compare with Bitcoin"} aria-pressed={basis === value} onClick={() => setBasis(value)} className={`min-h-11 min-w-20 rounded-md px-4 text-xs font-medium ${basis === value ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}>{value === "USD" ? data.currency : "vs BTC"}</button>)}</div><p className="text-[11px] text-zinc-400">{comparing ? "Outperformance vs Bitcoin" : `Portfolio return · ${data.currency}`} <span className="mx-1.5 text-zinc-700">/</span>{period === "YTD" ? "Year to date" : period === "ALL" ? "Since inception" : period.startsWith("YEAR:") ? period.slice(5) : period}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3"><p title={comparing ? "Portfolio return minus Bitcoin return. This is the arithmetic return gap, rather than BTC purchasing-power growth." : undefined} className={`text-[48px] font-medium leading-tight tracking-[-.055em] tabular-nums sm:text-[64px] ${negativeReturn ? "text-rose-300" : comparing ? "text-[#ff8b52]" : "text-[#7ad9b6]"}`}>{returnValue !== undefined ? pct(returnValue) : "—"}</p></div>
          {comparing && <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">{[[`Your portfolio · ${data.currency}`, m?.portfolio], [`100% Bitcoin hold · ${data.currency}`, m?.btc]].map(([label, value]) => <div key={label}><p className="text-[11px] text-zinc-400">{label}</p><p className="mt-1 text-lg tabular-nums text-zinc-200 sm:text-xl">{typeof value === "number" ? pct(value) : "—"}</p></div>)}</div>}
          <p className="mt-3 max-w-xl text-xs leading-5 text-zinc-400">{comparing ? `Both lines show ${data.currency} returns. Outperformance is your portfolio’s return minus Bitcoin’s return.` : `Shows the portfolio’s percentage gain or loss in ${data.currency}.`} All lines start at 0% for the selected period.</p>
        </div>
        <div role="group" aria-label="Performance period" className="flex items-start gap-1 self-start">{["YTD", "1M", "3M", "ALL"].map(p => <button key={p} type="button" aria-pressed={period === p} className={`min-h-11 rounded-lg px-3 text-xs ${period === p ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"}`} onClick={() => setPeriod(p)}>{p === "ALL" ? "All" : p}</button>)}<select aria-label="More performance periods" value={["6M", "1Y", "CUSTOM"].includes(period) || period.startsWith("YEAR:") ? period : ""} onChange={e => setPeriod(e.target.value)} className="min-h-11 max-w-24 rounded-lg bg-[#0a0a0c] px-2 text-xs text-zinc-400"><option value="" disabled>More</option><optgroup label="Years">{years.map(year => <option key={year} value={`YEAR:${year}`}>{year}</option>)}</optgroup><optgroup label="Other periods"><option value="6M">6 months</option><option value="1Y">1 year</option><option value="CUSTOM">Custom</option></optgroup></select></div>
      </div>
      {period === "CUSTOM" && <div className="flex flex-wrap gap-3 p-4 text-xs text-zinc-400"><label>From <input aria-label="Start date" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="min-h-11 rounded-lg bg-white/5 px-2"/></label><label>To <input aria-label="End date" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="min-h-11 rounded-lg bg-white/5 px-2"/></label></div>}
      <SpotPerformanceChart showOptions={false} key={`${basis}-${period}-${from}-${to}`} points={points} activity={[]} timeZone={PORTFOLIO_TIME_ZONE} tradeLabel="Show spot executions" comparison={comparing ? "usd-comparison" : "usd"} quoteCurrency={data.currency} costLabel={data.performanceCoverage || data.privacy ? "Historical performance · UTC" : data.history ? "Historical performance · UTC" : data.mode === "reconstructed" ? "Before fees · Estimated fills · UTC" : "Net of recorded fees · UTC"}/>
      {comparing && <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-t border-white/[.07] px-4 py-4 sm:px-7"><div><p className="text-xs text-zinc-300">BTC purchasing-power growth</p><p className="mt-1 max-w-xl text-[11px] leading-5 text-zinc-500">Change in how much Bitcoin the portfolio can buy. This is separate from the return gap above.</p></div><p className="text-lg tabular-nums text-zinc-200">{m ? pct(m.relative) : "—"}</p></div>}
      {(data.history || data.privacy) && points.length > 0 && <div role="note" aria-label="Performance coverage" className="border-t border-white/[.07] px-4 py-4 text-xs leading-6 text-zinc-400 sm:px-7"><p>{coverage}</p><p className="text-[11px] text-zinc-500">Individual trade records are kept private to protect wallet privacy.</p></div>}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[.07] bg-white/[.015] p-4 sm:flex-row sm:px-7"><p className="text-xs text-zinc-400">Follow the thinking behind the trades.</p><SubstackLink/></div>
    </section>
    <p className="!mt-3 text-center text-[10px] leading-5 text-zinc-500">{preview ? "Private draft preview · " : ""}{data.performanceCoverage || data.privacy ? "Historical performance" : data.history ? "Historical performance" : data.mode === "reconstructed" ? "Historical estimate · Fees excluded · Unlevered spot" : "Fictional prices and trades"} · Valued <time dateTime={data.asOf}>{date(data.asOf)} at {portfolioUpdateTime(data.asOf)}</time> · Kraken account disconnected</p>
    <div className="grid items-start gap-8 sm:gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-6">
      <PortfolioAllocation data={data} livePrices={!preview}/>
      <PortfolioIdeas ideas={data.stories?.ideas ?? []} notes={data.editorialNotes ?? []} historicalYear={historicalYear}/>
    </div>
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/[.08] p-5 sm:flex-row sm:items-center sm:p-6"><div><p className="text-base font-medium text-zinc-200">Follow the portfolio’s next chapter.</p><p className="mt-2 text-xs text-zinc-500">Portfolio notes, trade ideas and market analysis on Substack.</p></div><SubstackLink/></div>
    <details className="border-t border-white/[.08] text-xs text-zinc-500">
      <summary className="flex min-h-14 cursor-pointer items-center justify-between">Methodology & data coverage <span aria-hidden>+</span></summary>
      <div className="max-w-3xl space-y-4 pb-6 leading-6">
        {data.privacy && !data.history ? <>
          <p>This localhost view contains the current-period spot estimate and the recorded closed prop contribution. Trade-by-trade records and execution-linked ideas remain private. Standalone owner notes are displayed separately without execution details; Substack links are optional. This remains a localhost preview.</p>
          <p>The spot estimate uses owner-reported activity and historical market prices, excludes spot fees and assumes no external capital flows. Prop results preserve their recorded cost treatment; open prop mark-to-market is excluded. Removing direct identifiers reduces disclosure but does not guarantee wallet anonymity.</p>
        </> : data.history ? <>
          <p>Earlier history measures crypto spot and perpetual profit or loss against a fixed starting capital base. Trading fees and funding are included; gold and staking reward coins are excluded. Price gains on originally purchased assets remain included while staked. Daily estimates use trading records and historical prices reconciled to retained exchange PnL checkpoints.</p>
          <p>From {date(data.history.currentInceptionAt)}, performance follows the recorded spot portfolio estimate using owner-reported activity and Kraken market prices. {data.performanceCoverage || data.privacy ? <>Recorded closed prop trading results are included{data.performanceCoverage ? ` through ${date(data.performanceCoverage.propThrough)}` : ""}. Open prop mark-to-market is not included; the recorded R results carry their existing cost treatment. The spot estimate excludes fees.</> : <>This segment excludes spot fees.</>} No external cash flows are assumed.</p>
          <p>The periods are linked by multiplying their growth factors. Between the earlier cutoff and the current period, the chart carries the portfolio forward as cash based on the owner’s history. Exchange trading in that interval is outside this chart’s coverage; the cash bridge is an assumption, rather than verified continuous account history.</p>
        </> : <>
          <p>{data.mode === "reconstructed" ? "This estimated reconstruction uses owner-reported prices, inferred transaction dates and weekly DCA fills calibrated to a reported allocation checkpoint. Market marks come from Kraken daily data. It is not a verified exchange account record. Fees are excluded and no external capital flows are assumed." : "This entire review uses fictional balances, trades, financing costs and prices. It isn’t actual performance, an exchange connection or a strategy backtest."}</p>
          <p>{data.mode === "reconstructed" ? "This historical period contains unlevered spot trading only. Cash and owned assets make up portfolio equity; there are no margin positions or financing costs. The conditional future purchase is excluded until it executes. No DCA plan is currently active." : "Portfolio returns are time-weighted and adjust for external contributions and withdrawals. Internal transfers between Cold Storage and Margin Account don’t create gains. Recorded costs and open margin PnL are included; margin notional and collateral aren’t added to equity."}</p>
        </>}
        <p>BTC-relative growth = (1 + portfolio return) ÷ (1 + BTC return) − 1. Return difference subtracts BTC’s return from portfolio return. Both use the selected period’s matching valuation boundaries. The USD view shows portfolio percentage performance, green above 0% and red below. The vs BTC view compares orange portfolio USD performance with grey Bitcoin buy-and-hold USD performance. Its headline shows the arithmetic return gap with a % suffix; BTC purchasing-power growth is shown separately. Absolute balances, quantities and monetary values remain private.</p>
        <p>Maximum drawdown: {m ? pct(m.drawdown) : "—"}. BTC-relative drawdown: {m ? pct(m.relativeDrawdown) : "—"}. Current allocation uses the latest valuation independently of the period filter. Ideas describe the thesis rather than historical allocation changes. Detailed perp records are available only in private review.</p>
        <p>All dates, times and calendar filters use UTC · Inception {date(data.inceptionAt)} · Latest recorded activity {date(data.lastActivityAt)}.</p>
      </div>
    </details>
  </div>;
}
