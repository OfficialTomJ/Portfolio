"use client";

import Link from "next/link";
import { useState } from "react";
import { FaArrowRightLong } from "react-icons/fa6";
import { buildPerformanceView, getAvailableYears, signedR, sydneyDateKey } from "@/lib/performance/metrics";
import { performanceDatasets } from "@/lib/performance/mock";
import type { PerformanceRange } from "@/lib/performance/types";
import PerformanceCalendar from "./PerformanceCalendar";
import PerformanceEquityChart from "./PerformanceEquityChart";

const RANGES: { value: PerformanceRange; label: string }[] = [
  { value: "30D", label: "Last 30 days" },
  { value: "60D", label: "Last 60 days" },
  { value: "90D", label: "Last 90 days" },
  { value: "6M", label: "6 months" },
  { value: "YTD", label: "Year to date" },
  { value: "YEAR", label: "Calendar year" },
  { value: "CUSTOM", label: "Custom dates" },
];

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function pct(value: number | null): string {
  return value == null ? "N/A" : `${Math.round(value)}%`;
}

function decimal(value: number | null): string {
  if (value == null) return "N/A";
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

function Stat({ label, value, featured }: { label: string; value: string; featured?: boolean }) {
  return (
    <div className={`min-w-0 px-4 py-4 sm:px-5 sm:py-5 ${featured ? "bg-[#ff6719]/[0.055]" : ""}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500 sm:text-[11px]">
        {label}
      </p>
      <p className={`mt-2 truncate text-2xl font-medium tracking-tight sm:text-3xl ${featured ? "text-[var(--bp-accent)]" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

export default function PerformanceDashboard() {
  const [range, setRange] = useState<PerformanceRange>("30D");
  const dataset = performanceDatasets.mature;
  const asOfKey = dataset.asOf.slice(0, 10);
  const years = getAvailableYears(dataset);
  const [selectedYear, setSelectedYear] = useState(years[0] ?? 2026);
  const [customStart, setCustomStart] = useState("2026-08-18");
  const [customEnd, setCustomEnd] = useState(asOfKey);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const year = years.includes(selectedYear) ? selectedYear : years[0] ?? 2026;
  const customStartKey = customStart || dataset.inceptionAt.slice(0, 10);
  const customEndKey = customEnd || asOfKey;
  const customRange = customStartKey <= customEndKey
    ? { start: customStartKey, end: customEndKey }
    : { start: customEndKey, end: customStartKey };
  const view = buildPerformanceView(dataset, range, year, customRange);
  const { stats } = view;
  const visibleTrades = selectedDate
    ? view.trades.filter((item) => sydneyDateKey(item.closedAt) === selectedDate)
    : view.trades;
  const selectedDateLabel = selectedDate
    ? shortDateFormatter.format(new Date(`${selectedDate}T12:00:00Z`))
    : null;

  const selectRange = (nextRange: PerformanceRange) => {
    setRange(nextRange);
    setSelectedDate(null);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07090d]">
        <div className="flex flex-col gap-3 border-b border-white/[0.08] p-4 sm:flex-row sm:items-end sm:p-5">
          <label className="min-w-0 sm:w-52">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">Period</span>
            <select
              aria-label="Performance period"
              value={range}
              onChange={(event) => selectRange(event.target.value as PerformanceRange)}
              className="h-10 w-full rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-zinc-200 outline-none focus:border-[#ff6719]/50"
            >
              {RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          {range === "YEAR" && (
            <label className="sm:w-32">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">Year</span>
              <select
                aria-label="Calendar year"
                value={year}
                onChange={(event) => { setSelectedYear(Number(event.target.value)); setSelectedDate(null); }}
                className="h-10 w-full rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-zinc-200 outline-none focus:border-[#ff6719]/50"
              >
                {years.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          )}
          {range === "CUSTOM" && (
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">From</span>
                <input
                  type="date"
                  aria-label="Start date"
                  value={customStart}
                  max={customEnd}
                  onInput={(event) => { setCustomStart(event.currentTarget.value); setSelectedDate(null); }}
                  className="h-10 min-w-0 rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-zinc-200 outline-none [color-scheme:dark] focus:border-[#ff6719]/50"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">To</span>
                <input
                  type="date"
                  aria-label="End date"
                  value={customEnd}
                  min={customStart}
                  max={asOfKey}
                  onInput={(event) => { setCustomEnd(event.currentTarget.value); setSelectedDate(null); }}
                  className="h-10 min-w-0 rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-zinc-200 outline-none [color-scheme:dark] focus:border-[#ff6719]/50"
                />
              </label>
            </div>
          )}
          <p className="text-xs text-zinc-500 sm:ml-auto sm:pb-3">
            {shortDateFormatter.format(view.startsAt)} to {shortDateFormatter.format(view.endsAt)}
          </p>
        </div>

        {view.isPartial && (
          <div className="border-b border-[#ff6719]/10 bg-[#ff6719]/[0.045] px-4 py-3 text-xs text-[#ffb38d]/80 sm:px-5">
            Partial period · journal data begins {dateFormatter.format(new Date(dataset.inceptionAt))}
          </div>
        )}

        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.07] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <Stat label="Net result" value={signedR(stats.totalR)} featured />
          <Stat label="Win rate" value={pct(stats.winRate)} />
          <Stat label="Expectancy" value={stats.expectancy == null ? "N/A" : signedR(stats.expectancy)} />
          <Stat label="Max drawdown" value={signedR(stats.maxDrawdown)} />
          <Stat label="Profit factor" value={decimal(stats.profitFactor)} />
          <Stat label="Closed trades" value={String(stats.tradeCount)} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.09] bg-[#07090d] p-4 sm:p-6">
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-zinc-100">Cumulative R</h2>
          </div>
          <p className="text-xs text-zinc-500">Rebased to 0R</p>
        </div>
        <PerformanceEquityChart points={view.equity} />
      </section>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(19rem,.9fr)]">
        <PerformanceCalendar
          key={`${range}-${year}-${customRange.start}-${customRange.end}`}
          trades={view.trades}
          asOf={dataset.asOf}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        <section className="flex overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07090d] md:max-h-[650px] md:min-h-[520px] md:flex-col">
          <div className="flex items-end justify-between gap-4 border-b border-white/[0.08] px-4 py-5 sm:px-6">
            <div>
              <h2 className="text-lg font-medium">Closed trades</h2>
              {selectedDateLabel && <p className="mt-1 text-xs text-[#ff8b52]">Closed on {selectedDateLabel}</p>}
            </div>
            {selectedDate ? (
              <button type="button" onClick={() => setSelectedDate(null)} className="text-xs text-zinc-400 transition-colors hover:text-white">Clear day</button>
            ) : (
              <p className="text-xs text-zinc-500">Newest first</p>
            )}
          </div>
          {visibleTrades.length === 0 ? (
            <div className="grid flex-1 place-items-center px-5 py-16 text-center">
              <div>
                <p className="text-zinc-300">No closed trades {selectedDateLabel ? `on ${selectedDateLabel}` : "in this period"}.</p>
                <p className="mt-2 text-sm text-zinc-600">Choose another date or period.</p>
              </div>
            </div>
          ) : (
            <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
              {visibleTrades.map((item) => (
                <Link
                  key={item.id}
                  href={`/performance/trades/${item.id}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.07] px-4 py-4 transition-colors last:border-0 hover:bg-white/[0.025] sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{item.symbol.replace("USDT", " / USDT")}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.direction} · {dateFormatter.format(new Date(item.closedAt))}
                    </p>
                  </div>
                  <span className={`text-right text-sm font-semibold tabular-nums ${item.resultR >= 0 ? "text-[var(--bp-accent)]" : "text-zinc-300"}`}>
                    {signedR(item.resultR)}
                  </span>
                  <FaArrowRightLong className="hidden text-xs text-zinc-700 transition-transform group-hover:translate-x-1 group-hover:text-zinc-300" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
