"use client";

import Link from "next/link";
import { useState } from "react";
import { FaArrowRightLong } from "react-icons/fa6";
import {
  buildPerformanceView,
  calendarMonthRange,
  getAvailableYears,
  getCalendarMonthKeys,
  signedR,
  sydneyDateKey,
} from "@/lib/performance/metrics";
import type { PerformanceDataset, PerformanceRange } from "@/lib/performance/types";
import { track } from "@/lib/track";
import JournalUpdatesPrompt from "./JournalUpdatesPrompt";
import PerformanceCalendar from "./PerformanceCalendar";
import PerformanceEquityChart from "./PerformanceEquityChart";

const ROLLING_RANGES: { value: PerformanceRange; label: string }[] = [
  { value: "30D", label: "Last 30 days" },
  { value: "60D", label: "Last 60 days" },
  { value: "90D", label: "Last 90 days" },
  { value: "6M", label: "6 months" },
];

const CALENDAR_RANGES: { value: PerformanceRange; label: string }[] = [
  { value: "YTD", label: "Year to date" },
  { value: "YEAR", label: "Calendar year" },
  { value: "CUSTOM", label: "Custom dates" },
];

type PeriodSelection = PerformanceRange | `MONTH:${string}`;

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

const monthFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

function monthLabel(monthKey: string, currentMonthKey: string): string {
  const formatted = monthFormatter.format(new Date(`${monthKey}-01T00:00:00Z`));
  return monthKey === currentMonthKey
    ? `${formatted.replace(/ \d{4}$/, "")} (current)`
    : formatted;
}

function pct(value: number | null): string {
  return value == null ? "N/A" : `${Math.round(value)}%`;
}

function decimal(value: number | null): string {
  if (value == null) return "N/A";
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-3.5 sm:px-4 sm:py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500 sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1.5 break-words text-lg font-medium leading-tight tracking-tight text-zinc-100 sm:text-xl">
        {value}
      </p>
    </div>
  );
}

export default function PerformanceDashboard({
  dataset,
}: {
  dataset: PerformanceDataset;
}) {
  const [period, setPeriod] = useState<PeriodSelection>("30D");
  const asOfKey = sydneyDateKey(dataset.asOf);
  const inceptionKey = sydneyDateKey(dataset.inceptionAt);
  const monthKeys = getCalendarMonthKeys(dataset);
  const currentMonthKey = asOfKey.slice(0, 7);
  const selectedMonthKey = period.startsWith("MONTH:") ? period.slice(6) : null;
  const range = selectedMonthKey ? "CUSTOM" : period as PerformanceRange;
  const years = getAvailableYears(dataset);
  const fallbackYear = Number(asOfKey.slice(0, 4));
  const [selectedYear, setSelectedYear] = useState(years[0] ?? fallbackYear);
  const [customStart, setCustomStart] = useState(inceptionKey);
  const [customEnd, setCustomEnd] = useState(asOfKey);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const year = years.includes(selectedYear) ? selectedYear : years[0] ?? fallbackYear;
  const customStartKey = customStart || inceptionKey;
  const customEndKey = customEnd || asOfKey;
  const manualCustomRange = customStartKey <= customEndKey
    ? { start: customStartKey, end: customEndKey }
    : { start: customEndKey, end: customStartKey };
  const customRange = selectedMonthKey
    ? calendarMonthRange(selectedMonthKey, dataset.asOf)
    : manualCustomRange;
  const view = buildPerformanceView(dataset, range, year, customRange);
  const { stats } = view;
  const visibleTrades = selectedDate
    ? view.trades.filter((item) => sydneyDateKey(item.closedAt) === selectedDate)
    : view.trades;
  const selectedDateLabel = selectedDate
    ? shortDateFormatter.format(new Date(`${selectedDate}T12:00:00Z`))
    : null;

  const selectPeriod = (nextPeriod: PeriodSelection) => {
    setPeriod(nextPeriod);
    setSelectedDate(null);
    track("performance_period_change", { period: nextPeriod });
  };

  const selectDate = (date: string | null) => {
    setSelectedDate(date);
    if (date) track("performance_calendar_day_select", { period });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07090d]">
        <div className="border-b border-white/[0.08] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500 sm:text-[11px]">Net result</p>
              <p className="mt-1 text-4xl font-semibold leading-none tracking-[-0.045em] text-[var(--bp-accent)] sm:text-5xl">
                {signedR(stats.totalR)}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                {stats.tradeCount} closed trade{stats.tradeCount === 1 ? "" : "s"} in this period
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-3 min-[480px]:flex-row min-[480px]:items-end">
              <label className="min-w-0 min-[480px]:w-52">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">Period</span>
                <select
                  aria-label="Performance period"
                  value={period}
                  onChange={(event) => selectPeriod(event.target.value as PeriodSelection)}
                  className="h-10 w-full rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-zinc-200 outline-none focus:border-[#ff6719]/50"
                >
                  <optgroup label="Rolling periods">
                    {ROLLING_RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </optgroup>
                  <optgroup label="Calendar months">
                    {monthKeys.map((monthKey) => (
                      <option key={monthKey} value={`MONTH:${monthKey}`}>
                        {monthLabel(monthKey, currentMonthKey)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Calendar periods">
                    {CALENDAR_RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </optgroup>
                </select>
              </label>
              {range === "YEAR" && (
                <label className="min-[480px]:w-32">
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
            </div>
          </div>

          {period === "CUSTOM" && (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.07] pt-4 min-[480px]:grid-cols-2 sm:max-w-md sm:ml-auto">
              <label>
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">From</span>
                <input
                  type="date"
                  aria-label="Start date"
                  value={customStart}
                  max={customEnd}
                  onInput={(event) => { setCustomStart(event.currentTarget.value); setSelectedDate(null); }}
                  className="h-10 w-full min-w-0 rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-zinc-200 outline-none [color-scheme:dark] focus:border-[#ff6719]/50"
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
                  className="h-10 w-full min-w-0 rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-zinc-200 outline-none [color-scheme:dark] focus:border-[#ff6719]/50"
                />
              </label>
            </div>
          )}

          <p className="mt-3 text-xs text-zinc-500 sm:text-right">
            {shortDateFormatter.format(view.startsAt)} to {shortDateFormatter.format(view.endsAt)}
          </p>
        </div>

        {view.isPartial && (
          <div className="border-b border-[#ff6719]/10 bg-[#ff6719]/[0.045] px-4 py-3 text-xs text-[#ffb38d]/80 sm:px-5">
            Partial period · journal data begins {dateFormatter.format(new Date(dataset.inceptionAt))}
          </div>
        )}

        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.07] sm:grid-cols-4 sm:divide-y-0">
          <Stat label="Win rate" value={pct(stats.winRate)} />
          <Stat label="Expectancy" value={stats.expectancy == null ? "N/A" : signedR(stats.expectancy)} />
          <Stat label="Max drawdown" value={signedR(stats.maxDrawdown)} />
          <Stat label="Profit factor" value={decimal(stats.profitFactor)} />
        </div>

        <div className="border-t border-white/[0.08] p-4 sm:p-6">
          <div className="mb-2 flex items-end justify-between gap-4">
            <h2 className="text-lg font-medium text-zinc-100">Cumulative R</h2>
            <p className="text-xs text-zinc-500">Rebased to 0R</p>
          </div>
          <PerformanceEquityChart points={view.equity} />
        </div>
      </section>

      <JournalUpdatesPrompt />

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(19rem,.9fr)]">
        <PerformanceCalendar
          key={`${period}-${year}-${customRange.start}-${customRange.end}`}
          trades={view.trades}
          asOf={dataset.asOf}
          focusMonth={selectedMonthKey}
          selectedDate={selectedDate}
          onSelectDate={selectDate}
        />

        <section className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07090d] md:max-h-[650px] md:min-h-[520px]">
          <div className="flex flex-col items-start gap-2 border-b border-white/[0.08] px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-6">
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
                <p className="text-zinc-300">
                  {dataset.trades.length === 0
                    ? "No connected-account trades have closed and qualified for publication yet."
                    : `No closed trades ${selectedDateLabel ? `on ${selectedDateLabel}` : "in this period"}.`}
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  {dataset.trades.length === 0
                    ? "Open positions remain private and never appear here."
                    : "Choose another date or period."}
                </p>
              </div>
            </div>
          ) : (
            <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
              {visibleTrades.map((item) => (
                <Link
                  key={item.id}
                  href={`/performance/trades/${item.id}`}
                  onClick={() => track("performance_trade_open", { direction: item.direction.toLowerCase(), period })}
                  className="group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.07] px-4 py-4 transition-colors last:border-0 hover:bg-white/[0.025] sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium leading-5 text-zinc-100">{item.symbol.replace("USDT", " / USDT")}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] ${item.direction === "Long" ? "border-[#22c55e]/35 bg-[#22c55e]/[0.10] text-[#22c55e]" : "border-[#ef4444]/35 bg-[#ef4444]/[0.10] text-[#ef4444]"}`}>
                        {item.direction.toUpperCase()} {item.direction === "Long" ? "↑" : "↓"}
                      </span>
                      <span className="text-xs text-zinc-500">{dateFormatter.format(new Date(item.closedAt))}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${item.resultR >= 0 ? "text-[var(--bp-accent)]" : "text-zinc-300"}`}>
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
