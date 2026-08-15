"use client";

import type { CurrentState } from "@/lib/tjss/types";

// Observed Fear & Greed banding. This colours the INDEX reading itself, a
// published third-party datapoint, not a suggested course of action.
function fngColor(v: number | null): string {
  if (v == null) return "#a1a1aa";
  if (v <= 24) return "#ef4444";
  if (v <= 49) return "#f59e0b";
  if (v <= 74) return "#84cc16";
  return "#22c55e";
}

// Rule state is rendered in a single neutral accent, deliberately.
//
// Green-for-buy / red-for-sell carries a recommendation even when the words
// don't: a reader takes the colour as the instruction and skips the sentence.
// Since this panel reports what a documented ruleset did rather than advising
// anyone, the colour has to stay neutral too.
const RULE_STATE_COLOR = "#ff6719";

function fmtDate(t: number): string {
  return new Date(t * 1000).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

const SIGNAL_LABEL: Record<string, string> = {
  divLump: "Bullish divergence",
  washoutLump: "Single-day decline in fear",
  divTrim: "Bearish divergence",
  dcaBuy: "Scheduled interval",
};

export default function SignalPanel({ current }: { current: CurrentState }) {
  const color = fngColor(current.fng);
  const exposurePct = Math.round(current.targetExposure * 100);
  const isBull = current.regime === "bull";

  return (
    <div className="bp-surface rounded-xl p-5 flex flex-col gap-5">
      {/* Fear & Greed + regime */}
      <div className="flex items-center gap-4">
        <div className="grid place-items-center w-20 h-20 rounded-full shrink-0" style={{ border: `3px solid ${color}` }}>
          <span className="text-2xl font-semibold" style={{ color }}>{current.fng ?? "—"}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-[var(--bp-text-dim)]">Fear &amp; Greed</p>
          <p className="text-lg font-semibold" style={{ color }}>{current.classification ?? "Unavailable"}</p>
          {/* "as at" is load-bearing: the reading is anchored to the last bar
              with complete data, which is not always today. */}
          <p className="text-sm text-[var(--bp-text-dim)]">
            BTC ${current.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            {current.time ? ` · as at ${fmtDate(current.time)}` : ""}
          </p>
        </div>
      </div>

      {/* Regime + target exposure */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: isBull ? "#22c55e22" : "#ef444422", color: isBull ? "#22c55e" : "#ef4444" }}
        >
          {isBull ? "Bull regime" : "Bear regime"}
        </span>
        <span className="text-xs text-[var(--bp-text-dim)]">Model exposure</span>
        <span className="ml-auto text-sm font-semibold num" style={{ fontVariantNumeric: "tabular-nums" }}>{exposurePct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden -mt-2">
        <div
          className="h-full rounded-full"
          style={{ width: `${exposurePct}%`, background: RULE_STATE_COLOR }}
        />
      </div>
      <p className="-mt-3 text-[11px] leading-snug text-[var(--bp-text-dim)]">
        The share of the modelled portfolio the ruleset holds in BTC at this
        reading. A property of the model, not a position size for you.
      </p>

      {/* Rule state, an observation about the ruleset, not an instruction. */}
      <div>
        <p className="text-base font-semibold" style={{ color: RULE_STATE_COLOR }}>{current.action}</p>
        <p className="mt-1 text-sm text-[var(--bp-text-dim)] leading-snug">{current.detail}</p>
      </div>

      {/* Trend layer. Labels stay generic, the EMA length is a strategy
          parameter and lives server-side. */}
      {current.trend && (
        <div className="border-t border-[var(--bp-border)] pt-4">
          <p className="text-xs uppercase tracking-widest text-[var(--bp-text-dim)] mb-2">Trend</p>
          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-md px-2 py-1 text-xs font-medium"
              style={{
                background: current.trend.weeklyBull ? "#22c55e22" : "#ef444422",
                color: current.trend.weeklyBull ? "#22c55e" : "#ef4444",
              }}
            >
              Weekly {current.trend.weeklyBull ? "above" : "below"} trend
            </span>
            <span
              className="rounded-md px-2 py-1 text-xs font-medium"
              style={{
                background: current.trend.dailyBull ? "#22c55e22" : "#ef444422",
                color: current.trend.dailyBull ? "#22c55e" : "#ef4444",
              }}
            >
              Daily {current.trend.dailyBull ? "above" : "below"} trend
            </span>
            {current.trend.deepValue && (
              <span className="rounded-md bg-[#a78bfa22] px-2 py-1 text-xs font-medium text-[#a78bfa]">
                Deep value, price below its long-term trend
              </span>
            )}
          </div>
        </div>
      )}

      {/* Last recorded rule trigger, a dated historical observation. */}
      {current.lastSignal && (
        <div className="border-t border-[var(--bp-border)] pt-4">
          <p className="text-xs uppercase tracking-widest text-[var(--bp-text-dim)] mb-1">
            Last rule trigger
          </p>
          <p className="text-sm">
            <span className="font-semibold" style={{ color: RULE_STATE_COLOR }}>
              {SIGNAL_LABEL[current.lastSignal.type] ?? current.lastSignal.type}
            </span>{" "}
            <span className="text-[var(--bp-text-dim)]">
              on {fmtDate(current.lastSignal.time)} · F&amp;G {current.lastSignal.fng ?? "—"} · $
              {current.lastSignal.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
      )}

      <p className="border-t border-[var(--bp-border)] pt-4 text-[11px] leading-relaxed text-[var(--bp-text-dim)]">
        Research output. Describes a documented ruleset applied to public market
        and sentiment data. Not advice, not a recommendation, and not a signal to
        trade.
      </p>
    </div>
  );
}
