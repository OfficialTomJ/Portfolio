"use client";

import { useState } from "react";
import type { BacktestResult } from "@/lib/tjss/types";
import type { RiskMetrics } from "@/lib/tjss/metrics";
import EquityChart from "./EquityChart";
import EvidenceNote, { type EvidenceData } from "./EvidenceNote";
import ConfigControls, {
  type ViewConfig,
  type PresetOption,
  type ModeOption,
} from "./ConfigControls";

// One card covering "which strategy" and "what it did", because those are the
// same question. Strategy selection used to live in the rail beside the chart,
// two scroll positions away from the simulation that gives the choice meaning.
//
// Inputs here are the MEMBER's: how much they start with, what they add, over
// what period. The strategy's own sizing (how much of the cash each buy uses,
// how much a trim sells) and its execution assumptions come from the preset in
// Mongo. They are strategy, not preference, and are no longer editable or
// visible. Risk metrics arrive computed from the server.

interface Props {
  config: ViewConfig;
  presets: PresetOption[];
  modes: ModeOption[];
  onConfigChange: (next: ViewConfig) => void;
  modeLabel: string;
  evidence: EvidenceData | null;
}

// Numeric inputs are held as the RAW STRING the member typed, not as numbers.
// Coercing on every keystroke turned a cleared field into 0 and a half-typed
// one ("1e", "-") into NaN, which serialised to null and came back from zod as
// an opaque "Invalid request". The string is validated below and coerced once,
// on submit.
interface BtParams {
  initialCapital: string;
  contributionAmount: string;
  contributionCadenceDays: string;
  fromDate: string;
  toDate: string;
}

const DEFAULT_PARAMS: BtParams = {
  initialCapital: "10000",
  contributionAmount: "0",
  contributionCadenceDays: "30",
  fromDate: "",
  toDate: "",
};

// The same ranges the inputs advertise, and a subset of backtestRequestSchema's,
// so an out-of-range value is caught at the field that caused it rather than as
// a whole-request rejection.
const BOUNDS = {
  initialCapital: { min: 100, max: 10_000_000, integer: false },
  contributionAmount: { min: 0, max: 1_000_000, integer: false },
  contributionCadenceDays: { min: 1, max: 365, integer: true },
} as const;

type NumericKey = keyof typeof BOUNDS;

/** The typed string as a usable number, or null if it is not one yet. */
function parseField(key: NumericKey, raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  const { min, max, integer } = BOUNDS[key];
  if (!Number.isFinite(n) || n < min || n > max) return null;
  if (integer && !Number.isInteger(n)) return null;
  return n;
}

interface BacktestResponse extends BacktestResult {
  risk: RiskMetrics;
  buyHoldRisk: RiskMetrics;
}

// Plain-English definitions, shown on hover. These describe what each number
// measures. They do not say whether a value is good, or what to do about it.
const HINTS: Record<string, string> = {
  "Martin ratio":
    "Return per unit of sustained drawdown (CAGR ÷ ulcer index). Unlike max drawdown, it accounts for how deep and how long the portfolio stayed below its previous peak, not just the single worst moment.",
  "Max drawdown":
    "The largest peak-to-trough fall in portfolio value over the period. A single worst moment, not a typical one.",
  "Recovery from worst":
    "Days taken to climb back to the previous peak after the deepest trough.",
  "Time underwater":
    "Share of days spent below a previous peak. For a volatile asset in a long uptrend this is high for almost any approach.",
  "TJSS return":
    "Change in the modelled portfolio value over the period, after fees and slippage.",
  "Buy & hold":
    "The same starting capital placed in BTC at the start and held throughout, paying the same fees and slippage.",
  CAGR: "Compound annual growth rate, the constant yearly rate that would produce the same result over the period.",
  "Final equity": "Modelled portfolio value at the end of the period.",
  "Total invested": "Starting capital plus every contribution paid in over the period.",
  "Money-weighted return":
    "Annual return that accounts for when cash was added (IRR). CAGR is misleading once contributions are made over time; read this instead.",
  "MAR (CAGR÷DD)":
    "Return per unit of worst-case drawdown. Similar to the Martin ratio, but measured against the single deepest fall rather than sustained drawdown.",
  "Avg exposure":
    "Average share of the modelled portfolio held in BTC rather than cash across the period.",
  Sharpe:
    "Return per unit of total volatility. It counts large gains as 'risk' the same as large losses, and assumes returns are normally distributed. Neither holds well for crypto, so it understates approaches judged on drawdown.",
  "Execution costs":
    "Total fees and slippage paid across every modelled transaction.",
};

function Stat({ label, value, accent, compare }: {
  label: string; value: string; accent?: string; compare?: string;
}) {
  const hint = HINTS[label];
  return (
    <div className="bp-surface rounded-lg p-3 relative">
      {hint ? (
        // Hover/focus tooltip from sm upward only. Below that the grid is two
        // columns of ~150px while the tooltip is 224px wide, so a right-hand
        // cell would always run off-screen. No amount of re-anchoring fixes
        // that, so phones get the <Definitions> disclosure under the group
        // instead. tabIndex keeps it keyboard-reachable on desktop.
        <span className="group relative inline-block" tabIndex={0}>
          <p className="text-[11px] uppercase tracking-wider text-[var(--bp-text-dim)] sm:decoration-dotted sm:underline sm:underline-offset-2 sm:decoration-[var(--bp-border-strong)] sm:cursor-help">
            {label}
          </p>
          <span
            role="tooltip"
            className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1.5 hidden w-56 rounded-lg border border-[var(--bp-border-strong)] bg-[var(--bp-surface-2)] px-3 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-[var(--bp-text-dim)] opacity-0 shadow-xl transition-opacity duration-100 sm:block group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
          >
            {hint}
          </span>
        </span>
      ) : (
        <p className="text-[11px] uppercase tracking-wider text-[var(--bp-text-dim)]">{label}</p>
      )}
      <p className="text-lg font-semibold num" style={{ fontVariantNumeric: "tabular-nums", ...(accent ? { color: accent } : {}) }}>{value}</p>
      {compare && (
        <p className="text-[11px] text-[var(--bp-text-dim)]" style={{ fontVariantNumeric: "tabular-nums" }}>{compare}</p>
      )}
    </div>
  );
}

/**
 * The same definitions as the desktop tooltips, in a form that works on a phone.
 * Rendered below each stat group and hidden from sm upward, so there is exactly
 * one explanation mechanism visible at any width.
 */
function Definitions({ labels }: { labels: string[] }) {
  const defined = labels.filter((l) => HINTS[l]);
  if (!defined.length) return null;
  return (
    <details className="sm:hidden rounded-lg border border-[var(--bp-border)] bg-black/20">
      <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-[var(--bp-text-dim)]">
        ▸ What these figures mean
      </summary>
      <dl className="flex flex-col gap-2.5 px-3 pb-3 pt-1">
        {defined.map((l) => (
          <div key={l}>
            <dt className="text-[10px] uppercase tracking-wider text-[var(--bp-text-dim)]">{l}</dt>
            <dd className="text-[11px] leading-relaxed text-[var(--bp-text)]">{HINTS[l]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function GroupLabel({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <h4 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--bp-text)]">{title}</h4>
      <span className="text-[11px] text-[var(--bp-text-dim)]">{note}</span>
    </div>
  );
}
const fmtUsd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const fmtDate = (t: number) => new Date(t * 1000).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" });
const fmtDays = (d: number | null) => (d == null ? "not yet" : `${d}d`);

function Field({ label, value, min, max, step, onChange, suffix, invalid }: {
  label: string; value: string; min: number; max: number; step?: number; onChange: (v: string) => void; suffix?: string; invalid?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[var(--bp-text-dim)]">{label}{suffix ? ` (${suffix})` : ""}</span>
      <input type="number" value={value} min={min} max={max} step={step ?? 1}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-md bg-black/40 border px-2 py-1.5 text-sm focus:outline-none ${
          invalid
            ? "border-red-500/70 focus:border-red-500"
            : "border-[var(--bp-border)] focus:border-[var(--bp-accent)]"
        }`} />
      {invalid && (
        <span className="text-[10px] text-red-400">
          Enter a {BOUNDS_HINT[label] ?? "valid number"}
        </span>
      )}
    </label>
  );
}

// Keyed by the visible label so the message names the field's own range.
const BOUNDS_HINT: Record<string, string> = {
  "Starting capital": "number from 100 to 10,000,000",
  "Regular contribution": "number from 0 to 1,000,000",
  "Contribute every": "whole number of days from 1 to 365",
};

export default function BacktestPanel({
  config, presets, modes, onConfigChange, modeLabel, evidence,
}: Props) {
  const [params, setParams] = useState<BtParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<BtParams>) => setParams((p) => ({ ...p, ...patch }));

  const values = {
    initialCapital: parseField("initialCapital", params.initialCapital),
    contributionAmount: parseField("contributionAmount", params.contributionAmount),
    contributionCadenceDays: parseField("contributionCadenceDays", params.contributionCadenceDays),
  };
  const hasInvalidField = Object.values(values).some((v) => v == null);

  async function run() {
    if (hasInvalidField) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        preset: config.presetId,
        mode: config.mode,
        initialCapital: values.initialCapital,
      };
      if ((values.contributionAmount ?? 0) > 0) {
        body.contributionAmount = values.contributionAmount;
        body.contributionCadenceDays = values.contributionCadenceDays;
      }
      if (params.fromDate) body.fromDate = params.fromDate;
      if (params.toDate) body.toDate = params.toDate;

      const res = await fetch("/api/tjss/backtest", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      setResult((await res.json()) as BacktestResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setLoading(false);
    }
  }

  const stats = result?.stats;
  const risk = result?.risk;
  const bhRisk = result?.buyHoldRisk;
  const contributing = (values.contributionAmount ?? 0) > 0;

  return (
    <div className="bp-surface rounded-xl p-5 flex flex-col gap-5">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--bp-text-dim)]">
        Strategy
      </h3>

      <ConfigControls
        config={config}
        presets={presets}
        modes={modes}
        onChange={onConfigChange}
      />

      <div className="border-t border-[var(--bp-border)]" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--bp-text-dim)]">
          Historical simulation · <span className="text-[var(--bp-accent)]">{modeLabel}</span>
        </h3>
        <button onClick={run} disabled={loading || hasInvalidField}
          title={hasInvalidField ? "Check the highlighted fields" : undefined}
          className="rounded-md bg-[var(--bp-accent)] text-black font-semibold px-4 py-1.5 text-sm hover:brightness-110 transition disabled:opacity-60">
          {loading ? "Running…" : "Run simulation"}
        </button>
      </div>

      {/* Five fields flowing naturally. The empty spacer that used to sit here
          only existed to push the dates onto their own row at sm, and cost a
          whole cell of a two-column phone grid. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Field label="Starting capital" suffix="$" value={params.initialCapital} min={BOUNDS.initialCapital.min} max={BOUNDS.initialCapital.max} invalid={values.initialCapital == null} onChange={(v) => set({ initialCapital: v })} />
        <Field label="Regular contribution" suffix="$, 0 = none" value={params.contributionAmount} min={BOUNDS.contributionAmount.min} max={BOUNDS.contributionAmount.max} invalid={values.contributionAmount == null} onChange={(v) => set({ contributionAmount: v })} />
        <Field label="Contribute every" suffix="days" value={params.contributionCadenceDays} min={BOUNDS.contributionCadenceDays.min} max={BOUNDS.contributionCadenceDays.max} invalid={values.contributionCadenceDays == null} onChange={(v) => set({ contributionCadenceDays: v })} />
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--bp-text-dim)]">From (optional)</span>
          <input type="date" value={params.fromDate} onChange={(e) => set({ fromDate: e.target.value })}
            className="rounded-md bg-black/40 border border-[var(--bp-border)] px-2 py-1.5 text-sm focus:border-[var(--bp-accent)] focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--bp-text-dim)]">To (optional)</span>
          <input type="date" value={params.toDate} onChange={(e) => set({ toDate: e.target.value })}
            className="rounded-md bg-black/40 border border-[var(--bp-border)] px-2 py-1.5 text-sm focus:border-[var(--bp-accent)] focus:outline-none" />
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {stats && result && risk && bhRisk && (
        <>
          {/* Risk leads. Across every test, in-sample, holdout and simulated,
              the smoother path is the result that reproduces; the return edge
              is not. See the evidence note below. */}
          <div className="flex flex-col gap-3">
            <GroupLabel title="Risk" note="what this strategy is for, compared against buy &amp; hold" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Martin ratio" value={risk.martinRatio.toFixed(2)} accent="#ff6719"
                compare={`B&H ${bhRisk.martinRatio.toFixed(2)}`} />
              <Stat label="Max drawdown" value={fmtPct(stats.maxDrawdownPct)} accent="#ef4444"
                compare={`B&H ${fmtPct(stats.buyHoldMaxDrawdownPct)}`} />
              <Stat label="Recovery from worst" value={fmtDays(risk.recoveryDays)}
                compare={`B&H ${fmtDays(bhRisk.recoveryDays)}`} />
              <Stat label="Time underwater" value={`${risk.timeUnderwaterPct.toFixed(0)}%`}
                compare={`B&H ${bhRisk.timeUnderwaterPct.toFixed(0)}%`} />
            </div>
            <Definitions
              labels={["Martin ratio", "Max drawdown", "Recovery from worst", "Time underwater"]}
            />
          </div>

          <div className="flex flex-col gap-3">
            <GroupLabel title="Return" note="secondary, least reproducible across holdouts" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 opacity-80">
              <Stat label="TJSS return" value={fmtPct(stats.totalReturnPct)} accent={stats.totalReturnPct >= 0 ? "#22c55e" : "#ef4444"} />
              <Stat label="Buy &amp; hold" value={fmtPct(stats.buyHoldReturnPct)} />
              {contributing ? (
                <>
                  <Stat label="Total invested" value={fmtUsd(stats.totalInvested)} />
                  <Stat label="Money-weighted return" value={fmtPct(stats.irrPct)} />
                </>
              ) : (
                <>
                  <Stat label="CAGR" value={fmtPct(stats.cagrPct)} />
                  <Stat label="Final equity" value={fmtUsd(stats.finalEquity)} />
                </>
              )}
              <Stat label="MAR (CAGR÷DD)" value={stats.mar.toFixed(2)} />
              <Stat label="Avg exposure" value={`${Math.round(stats.avgExposure * 100)}%`} />
              <Stat label="Sharpe" value={risk.sharpe.toFixed(2)} compare={`B&H ${bhRisk.sharpe.toFixed(2)}`} />
              <Stat label="Execution costs" value={fmtUsd(stats.totalCosts)} />
            </div>
            <Definitions
              labels={[
                "TJSS return", "Buy & hold",
                ...(contributing
                  ? ["Total invested", "Money-weighted return"]
                  : ["CAGR", "Final equity"]),
                "MAR (CAGR÷DD)", "Avg exposure", "Sharpe", "Execution costs",
              ]}
            />
          </div>

          <EquityChart equity={result.equity} />

          <EvidenceNote evidence={evidence} />

          {/* min-w forces horizontal scroll instead of letting the Trigger
              column ("Bearish sentiment divergence at greed 74") wrap every row
              to four lines on a phone. */}
          <div className="max-h-64 overflow-auto rounded-lg border border-[var(--bp-border)]">
            <table className="w-full min-w-[520px] text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead className="sticky top-0 bg-[var(--bp-surface-2)] text-[var(--bp-text-dim)]">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Date</th>
                  <th className="text-left font-medium px-3 py-2">Trigger</th>
                  <th className="text-right font-medium px-3 py-2">Price</th>
                  <th className="text-right font-medium px-3 py-2">USD</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i} className="border-t border-[var(--bp-border)]">
                    <td className="px-3 py-1.5">{fmtDate(t.time)}</td>
                    <td className="px-3 py-1.5 font-medium" style={{ color: t.side === "buy" ? "#22c55e" : "#ef4444" }}>{t.reason}</td>
                    <td className="px-3 py-1.5 text-right">{fmtUsd(t.price)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtUsd(t.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!stats && !error && (
        <p className="text-sm text-[var(--bp-text-dim)]">
          Run a historical simulation of the <b>{modeLabel}</b> ruleset over BTC history
          with your own starting capital and contributions.
        </p>
      )}
    </div>
  );
}
