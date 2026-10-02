"use client";

import { useState } from "react";
import { asrStatus, buildAsrComparison, matchesTradeFilters, type TradeAnnotation, type TradeTypeFilter } from "@/lib/performance/annotations-model";
import { buildPerformanceView, calendarMonthRange, getAvailableYears, getCalendarMonthKeys, signedR, sydneyDateKey } from "@/lib/performance/metrics";
import type { AdminActivePosition, AdminPendingReview } from "@/lib/performance/admin-selection";
import type { PerformanceDataset, PerformanceRange, TradeTag } from "@/lib/performance/types";
import AdminTradeManager from "./AdminTradeManager";
import MultiSelectFilter from "./MultiSelectFilter";
import PerformanceEquityChart from "./PerformanceEquityChart";

type Period = PerformanceRange | `MONTH:${string}`;
const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" });
const month = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" });
const selectClass = "h-10 w-full min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-zinc-200 outline-none focus:border-[#ff6719]/60";
const periods = [{ id: "30D", name: "Last 30 days" }, { id: "60D", name: "Last 60 days" }, { id: "90D", name: "Last 90 days" }, { id: "6M", name: "6 months" }];
const types = [{ id: "DAY", name: "DAY" }, { id: "SWING", name: "SWING" }, { id: "UNCLASSIFIED", name: "Unclassified" }];

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1.5 break-words text-xl font-medium tabular-nums text-zinc-100 sm:text-2xl">{value}</p></div>;
}

export default function PrivatePerformanceDashboard({ dataset, pendingReviews, activePositions, annotations, tags }: {
  dataset: PerformanceDataset; pendingReviews: AdminPendingReview[]; activePositions: AdminActivePosition[];
  annotations: Record<string, TradeAnnotation>; tags: TradeTag[];
}) {
  const [period, setPeriod] = useState<Period>("30D");
  const years = getAvailableYears(dataset);
  const [year, setYear] = useState(years[0] ?? Number(sydneyDateKey(dataset.asOf).slice(0, 4)));
  const [start, setStart] = useState(sydneyDateKey(dataset.inceptionAt));
  const [end, setEnd] = useState(sydneyDateKey(dataset.asOf));
  const [typeFilters, setTypeFilters] = useState<TradeTypeFilter[]>([]);
  const [strategyFilters, setStrategyFilters] = useState<string[]>([]);
  const [mode, setMode] = useState<"actual" | "asr">("actual");
  const [validity, setValidity] = useState<"all" | "valid" | "invalid">("all");
  const months = getCalendarMonthKeys(dataset);
  const monthKey = period.startsWith("MONTH:") ? period.slice(6) : null;
  const startKey = start || sydneyDateKey(dataset.inceptionAt);
  const endKey = end || sydneyDateKey(dataset.asOf);
  const custom = monthKey ? calendarMonthRange(monthKey, dataset.asOf) : startKey <= endKey ? { start: startKey, end: endKey } : { start: endKey, end: startKey };
  const filtered = { ...dataset, trades: dataset.trades.filter(trade => matchesTradeFilters(annotations[trade.id]?.tradeType, annotations[trade.id]?.strategyIds ?? [], typeFilters, strategyFilters)) };
  const view = buildPerformanceView(filtered, monthKey ? "CUSTOM" : period as PerformanceRange, year, custom);
  const comparison = buildAsrComparison(view.trades, annotations, view.startsAt, validity);
  const stats = view.stats;
  const needsAsr = dataset.trades.filter(trade => asrStatus(annotations[trade.id]) !== "Reviewed").length;
  const chips = [...typeFilters.map(id => ({ id, name: types.find(type => type.id === id)!.name, type: true })), ...strategyFilters.map(id => ({ id, name: tags.find(tag => tag.id === id)?.name ?? "Strategy", type: false }))];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500" aria-label="Review progress">
      <span>All history</span><span><span className="font-medium text-zinc-200">{needsAsr}</span> need ASR</span><span><span className="font-medium text-zinc-200">{pendingReviews.length}</span> unpublished</span><span><span className="font-medium text-zinc-200">{activePositions.length}</span> active</span>
    </div>
    <section aria-label="Private performance overview" className="overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]">
      <header className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <h2 className="text-lg font-medium">Performance</h2>
        <div className="flex flex-wrap gap-2">{[{ id: "actual", name: "All actual results" }, { id: "asr", name: "ASR comparison" }].map(item => <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => setMode(item.id as typeof mode)} className={`min-h-10 rounded-lg border px-3 py-2 text-sm ${mode === item.id ? "border-[#ff6719]/40 bg-[#ff6719]/[0.08] text-[#ffad83]" : "border-white/10 text-zinc-400"}`}>{item.name}</button>)}</div>
      </header>
      <div className="space-y-3 border-b border-white/10 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-end">
          <label className="min-w-0 min-[480px]:w-52"><span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Period</span><select aria-label="Performance period" value={period} onChange={event => setPeriod(event.target.value as Period)} className={selectClass}>
            <optgroup label="Rolling periods">{periods.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
            <optgroup label="Calendar months">{months.map(key => <option key={key} value={`MONTH:${key}`}>{month.format(new Date(`${key}-01T00:00:00Z`))}{key === sydneyDateKey(dataset.asOf).slice(0, 7) ? " (current)" : ""}</option>)}</optgroup>
            <optgroup label="Calendar periods"><option value="YTD">Year to date</option><option value="YEAR">Calendar year</option><option value="CUSTOM">Custom dates</option></optgroup>
          </select></label>
          <MultiSelectFilter label="Trade type" options={types} selected={typeFilters} onChange={ids => setTypeFilters(ids as TradeTypeFilter[])} />
          <MultiSelectFilter label="Strategies" options={tags} selected={strategyFilters} onChange={setStrategyFilters} searchable />
          {period === "YEAR" && <label className="min-w-0 min-[480px]:w-32"><span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Year</span><select aria-label="Calendar year" value={year} onChange={event => setYear(Number(event.target.value))} className={selectClass}>{(years.length ? years : [year]).map(value => <option key={value}>{value}</option>)}</select></label>}
          {mode === "asr" && <label className="min-w-0 min-[480px]:w-44"><span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Trade validity</span><select aria-label="ASR trade validity" value={validity} onChange={event => setValidity(event.target.value as typeof validity)} className={selectClass}><option value="all">All reviewed</option><option value="valid">Valid only</option><option value="invalid">Invalid only</option></select></label>}
        </div>
        {period === "CUSTOM" && <div className="grid max-w-md gap-3 min-[480px]:grid-cols-2"><label className="text-xs text-zinc-500">From<input type="date" aria-label="Start date" value={start} max={end || sydneyDateKey(dataset.asOf)} onInput={event => setStart(event.currentTarget.value)} className={`mt-1.5 ${selectClass} [color-scheme:dark]`} /></label><label className="text-xs text-zinc-500">To<input type="date" aria-label="End date" value={end} min={start || undefined} max={sydneyDateKey(dataset.asOf)} onInput={event => setEnd(event.currentTarget.value)} className={`mt-1.5 ${selectClass} [color-scheme:dark]`} /></label></div>}
        {!!chips.length && <div className="flex flex-wrap items-center gap-2" aria-label="Selected filters">{chips.map(chip => <button key={`${chip.type}-${chip.id}`} type="button" aria-label={`Remove ${chip.name} filter`} onClick={() => chip.type ? setTypeFilters(old => old.filter(id => id !== chip.id)) : setStrategyFilters(old => old.filter(id => id !== chip.id))} className="max-w-full break-words rounded-full border border-[#ff6719]/30 px-3 py-1.5 text-xs text-[#ffad83]">{chip.name} ×</button>)}<button type="button" onClick={() => { setTypeFilters([]); setStrategyFilters([]); }} className="min-h-10 px-2 text-xs text-zinc-400">Clear filters</button></div>}
        <p className="text-xs leading-5 text-zinc-500">{date.format(view.startsAt)} to {date.format(view.endsAt)}{view.isPartial ? ` · Data begins ${date.format(new Date(dataset.inceptionAt))}` : ""}</p>
      </div>
      {mode === "actual" ? <div className="space-y-5 p-4 sm:p-5">
        <div><p className="text-xs text-zinc-500">Net result</p><p className="mt-1 text-4xl font-semibold tracking-tight text-[#ff6719] sm:text-5xl">{signedR(stats.totalR)}</p><p className="mt-2 text-xs text-zinc-500">{stats.tradeCount} closed trades · {comparison.reviewedCount} ASRs complete</p></div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4"><Metric label="Win rate" value={stats.winRate == null ? "N/A" : `${Math.round(stats.winRate)}%`} /><Metric label="Expectancy" value={stats.expectancy == null ? "N/A" : signedR(stats.expectancy)} /><Metric label="Max drawdown" value={signedR(stats.maxDrawdown)} /><Metric label="Profit factor" value={stats.profitFactor == null ? "N/A" : Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} /></div>
      </div> : <div className="space-y-3 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 min-[375px]:grid-cols-3"><Metric label="Reviewed actual R" value={comparison.pairedCount ? signedR(comparison.actualR) : "N/A"} /><Metric label="ASR expected R" value={comparison.pairedCount ? signedR(comparison.expectedR) : "N/A"} /><Metric label="Review gap" value={comparison.pairedCount ? signedR(comparison.gap) : "N/A"} /></div>
        <p className="text-xs leading-5 text-zinc-500">{comparison.pairedCount} reviewed trades included · {comparison.reviewedCount} of {comparison.eligibleCount} ASRs complete · {comparison.validCount} valid · {comparison.invalidCount} invalid</p>
      </div>}
      <div className="border-t border-white/10 p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-medium">{mode === "actual" ? "Cumulative R" : "Actual vs expected"}</h3>
        {mode === "actual" ? <PerformanceEquityChart key="actual" points={view.equity} /> : comparison.pairedCount ? <PerformanceEquityChart key="asr" points={comparison.actual} comparisonPoints={comparison.expected} /> : <div className="grid h-52 place-items-center text-center text-sm text-zinc-400">No completed ASRs in this selection.</div>}
        <p className="mt-3 text-xs leading-5 text-zinc-500">{mode === "actual" ? `Actual results for all ${view.trades.length} closed trades in this selection, including unpublished and unreviewed trades.` : `Both curves use the same ${comparison.pairedCount} reviewed trades. Expected R is your assessment; gap = expected minus actual.`}</p>
      </div>
    </section>
    <AdminTradeManager trades={view.trades} pendingReviews={pendingReviews} activePositions={activePositions} annotations={annotations} tags={tags} typeFilters={typeFilters} strategyFilters={strategyFilters} />
  </div>;
}
