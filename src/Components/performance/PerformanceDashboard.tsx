"use client";

import Link from "next/link";
import { useState } from "react";
import { FaArrowRightLong } from "react-icons/fa6";
import { buildPerformanceView, getAvailableYears, signedR } from "@/lib/performance/metrics";
import { performanceDatasets } from "@/lib/performance/mock";
import type { PerformanceDataset, PerformanceRange } from "@/lib/performance/types";
import PerformanceCalendar from "./PerformanceCalendar";
import PerformanceEquityChart from "./PerformanceEquityChart";

const RANGES: { value: PerformanceRange; label: string }[] = [
  { value: "30D", label: "30 days" },
  { value: "90D", label: "90 days" },
  { value: "YTD", label: "YTD" },
  { value: "YEAR", label: "Yearly" },
];

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function pct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

function decimal(value: number | null): string {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

function Stat({ label, value, featured }: { label: string; value: string; featured?: boolean }) {
  return (
    <div className={`min-w-0 px-4 py-4 sm:px-5 sm:py-5 ${featured ? "bg-blue-500/[0.055]" : ""}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500 sm:text-[11px]">
        {label}
      </p>
      <p className={`mt-2 truncate text-2xl font-medium tracking-tight sm:text-3xl ${featured ? "text-blue-400" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

export default function PerformanceDashboard() {
  const [datasetId, setDatasetId] = useState<PerformanceDataset["id"]>("new");
  const [range, setRange] = useState<PerformanceRange>("30D");
  const dataset = performanceDatasets[datasetId];
  const years = getAvailableYears(dataset);
  const [selectedYear, setSelectedYear] = useState(years[0] ?? 2026);
  const year = years.includes(selectedYear) ? selectedYear : years[0] ?? 2026;
  const view = buildPerformanceView(dataset, range, year);
  const { stats } = view;

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07090d]">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Preview dataset</p>
            <p className="mt-1 text-sm text-zinc-300">{dataset.description}</p>
          </div>
          <div className="flex w-full rounded-lg border border-white/[0.09] bg-black p-1 sm:w-auto">
            {Object.values(performanceDatasets).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDatasetId(item.id)}
                className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none ${datasetId === item.id ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-white/[0.08] p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {RANGES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setRange(item.value)}
              className={`min-w-fit rounded-lg px-4 py-2.5 text-sm transition-colors ${range === item.value ? "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/25" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"}`}
            >
              {item.label}
            </button>
          ))}
          {range === "YEAR" && (
            <select
              aria-label="Calendar year"
              value={year}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="ml-auto rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-zinc-300 outline-none focus:border-blue-400/50"
            >
              {years.map((item) => <option key={item}>{item}</option>)}
            </select>
          )}
        </div>

        {view.isPartial && (
          <div className="border-b border-blue-400/10 bg-blue-400/[0.045] px-4 py-3 text-xs text-blue-200/80 sm:px-5">
            Partial period · journal data begins {dateFormatter.format(new Date(dataset.inceptionAt))}
          </div>
        )}

        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.07] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <Stat label="Net result" value={signedR(stats.totalR)} featured />
          <Stat label="Win rate" value={pct(stats.winRate)} />
          <Stat label="Expectancy" value={stats.expectancy == null ? "—" : signedR(stats.expectancy)} />
          <Stat label="Max drawdown" value={signedR(stats.maxDrawdown)} />
          <Stat label="Profit factor" value={decimal(stats.profitFactor)} />
          <Stat label="Closed trades" value={String(stats.tradeCount)} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.09] bg-[#07090d] p-4 sm:p-6">
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Cumulative performance</p>
            <h2 className="mt-1 text-lg font-medium text-zinc-100">Equity in R</h2>
          </div>
          <p className="text-xs text-zinc-500">Rebased to 0R</p>
        </div>
        <PerformanceEquityChart points={view.equity} />
      </section>

      <PerformanceCalendar
        key={`${dataset.id}-${range}-${year}`}
        trades={view.trades}
        asOf={dataset.asOf}
      />

      <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07090d]">
        <div className="flex items-end justify-between gap-4 border-b border-white/[0.08] px-4 py-5 sm:px-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Journal</p>
            <h2 className="mt-1 text-lg font-medium">Closed trades</h2>
          </div>
          <p className="text-xs text-zinc-500">Newest first</p>
        </div>
        {view.trades.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-zinc-300">No closed trades in this period.</p>
            <p className="mt-2 text-sm text-zinc-600">Results will appear here once a position is fully closed.</p>
          </div>
        ) : (
          <div>
            {view.trades.map((item) => (
              <Link
                key={item.id}
                href={`/performance/trades/${item.id}`}
                className="group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.07] px-4 py-4 transition-colors last:border-0 hover:bg-white/[0.025] sm:grid-cols-[1.2fr_.7fr_.8fr_.55fr_auto] sm:px-6"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{item.symbol.replace("USDT", " / USDT")}</p>
                  <p className="mt-1 text-xs text-zinc-500 sm:hidden">
                    {item.direction} · {dateFormatter.format(new Date(item.closedAt))}
                  </p>
                </div>
                <span className="hidden text-sm text-zinc-400 sm:block">{item.direction}</span>
                <span className="hidden text-sm text-zinc-500 sm:block">{dateFormatter.format(new Date(item.closedAt))}</span>
                <span className={`text-right text-sm font-semibold tabular-nums ${item.resultR >= 0 ? "text-blue-400" : "text-zinc-300"}`}>
                  {signedR(item.resultR)}
                </span>
                <FaArrowRightLong className="hidden text-xs text-zinc-700 transition-transform group-hover:translate-x-1 group-hover:text-zinc-300 sm:block" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
