"use client";

import { useMemo, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { signedR, sydneyDateKey } from "@/lib/performance/metrics";
import type { PerformanceTrade } from "@/lib/performance/types";

const MONTH = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

function monthFromTrades(trades: PerformanceTrade[], fallback: string): Date {
  const key = trades[0] ? sydneyDateKey(trades[0].closedAt).slice(0, 7) : fallback.slice(0, 7);
  return new Date(`${key}-01T00:00:00Z`);
}

export default function PerformanceCalendar({
  trades,
  asOf,
  selectedDate,
  onSelectDate,
}: {
  trades: PerformanceTrade[];
  asOf: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const latest = useMemo(() => monthFromTrades(trades, asOf), [trades, asOf]);
  const [month, setMonth] = useState(latest);

  const totals = useMemo(() => {
    const map = new Map<string, { result: number; count: number }>();
    for (const item of trades) {
      const key = sydneyDateKey(item.closedAt);
      const current = map.get(key) ?? { result: 0, count: 0 };
      current.result += item.resultR;
      current.count += 1;
      map.set(key, current);
    }
    return map;
  }, [trades]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    const gridStart = new Date(first.getTime() - mondayOffset * 86_400_000);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart.getTime() + index * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      return {
        date,
        key,
        current: date.getUTCMonth() === month.getUTCMonth(),
        total: totals.get(key),
      };
    });
  }, [month, totals]);

  const move = (amount: number) => {
    setMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1)));
  };

  return (
    <section className="rounded-2xl border border-white/[0.09] bg-[#07090d] p-3 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Daily results (R)</p>
          <h2 className="mt-1 text-lg font-medium">{MONTH.format(month)}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => move(-1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <FaChevronLeft className="text-xs" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => move(1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <FaChevronRight className="text-xs" />
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 sm:gap-1.5 xl:gap-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="pb-1 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 sm:text-[11px]">
            {day.slice(0, 1)}<span className="hidden sm:inline">{day.slice(1)}</span>
          </div>
        ))}
        {cells.map((cell) => {
          const value = cell.total?.result ?? 0;
          const intensity = Math.min(0.24, 0.065 + Math.abs(value) * 0.055);
          return (
            <button
              key={cell.key}
              type="button"
              aria-label={`${cell.key}${cell.total ? `, ${signedR(value)} across ${cell.total.count} trade${cell.total.count === 1 ? '' : 's'}` : ', no closed trades'}`}
              aria-pressed={selectedDate === cell.key}
              onClick={() => onSelectDate(selectedDate === cell.key ? null : cell.key)}
              title={cell.total ? `${cell.key}: ${signedR(value)} across ${cell.total.count} trade${cell.total.count === 1 ? '' : 's'}` : cell.key}
              className={`aspect-square min-w-0 rounded-md border p-0.5 text-left transition min-[360px]:p-1 sm:rounded-lg sm:p-1.5 xl:p-2 ${cell.current ? "border-white/[0.07] hover:border-white/20" : "border-transparent opacity-25"} ${selectedDate === cell.key ? "ring-2 ring-[#ff6719] ring-offset-2 ring-offset-[#07090d]" : ""}`}
              style={cell.total ? { backgroundColor: value >= 0 ? `rgba(255,103,25,${intensity})` : `rgba(113,113,122,${intensity})`, borderColor: value >= 0 ? 'rgba(255,103,25,0.24)' : 'rgba(161,161,170,0.16)' } : { backgroundColor: 'rgba(255,255,255,0.015)' }}
            >
              <div className="flex h-full min-w-0 flex-col justify-between">
                <span className="text-xs leading-none text-zinc-500 sm:text-[11px] xl:text-xs">{cell.date.getUTCDate()}</span>
                {cell.total && (
                  <span className={`whitespace-nowrap text-[13px] font-semibold leading-none tabular-nums sm:text-[11px] xl:text-xs ${value >= 0 ? 'text-[#ff8b52]' : 'text-zinc-300'}`}>
                    {signedR(value, 1).slice(0, -1)}<span className="hidden sm:inline">R</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        Select a day to filter the trades below. Blank days had no closed trades.
      </p>
    </section>
  );
}
