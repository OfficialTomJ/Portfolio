"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MdFullscreen, MdFullscreenExit } from "react-icons/md";
import type { CurrentState } from "@/lib/tjss/types";
import TjssChart, {
  EMA_META,
  type ChartCandle,
  type ChartFng,
  type ChartMarker,
  type RegimePoint,
  type EmaSeries,
  type EmaKey,
  type EmaToggles,
} from "./TjssChart";
import SignalPanel from "./SignalPanel";
import {
  type ViewConfig,
  type PresetOption,
  type ModeOption,
} from "./ConfigControls";
import BacktestPanel from "./BacktestPanel";
import type { EvidenceData } from "./EvidenceNote";

// Container. Holds only the member's own view choices: which strategy, which
// allocation mode, which timeframe, which overlays. It has no strategy config
// to hold: the parameters live in Mongo and are applied server-side, so the
// only thing on the wire is `?preset=&mode=&tf=`.

type Timeframe = "D" | "W" | "M";

interface MarketData {
  candles: ChartCandle[];
  fng: ChartFng[];
  markers: ChartMarker[];
  regime: RegimePoint[];
  emas: EmaSeries[];
  levels: { fear: number; greed: number };
  current: CurrentState;
  meta: { presetId: string; timeframe: Timeframe; lastFng: number | null; updatedAt: string };
}

interface Bootstrap {
  presets: PresetOption[];
  modes: ModeOption[];
  evidence: EvidenceData;
}

// `short` is shown below the sm breakpoint so the toolbar stays one row on a phone.
const TIMEFRAMES: { key: Timeframe; label: string; short: string }[] = [
  { key: "D", label: "Daily", short: "D" },
  { key: "W", label: "Weekly", short: "W" },
  { key: "M", label: "Monthly", short: "M" },
];

const NO_EMAS: EmaToggles = { daily: false, weekly: false, monthly: false };

export default function TjssDashboard() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [config, setConfig] = useState<ViewConfig | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("D");
  const [emas, setEmas] = useState<EmaToggles>(NO_EMAS);
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // Chart expanded to fill the viewport. This is a CSS overlay, NOT the native
  // Fullscreen API: browser chrome stays visible, and iOS Safari, which does
  // not implement requestFullscreen() outside <video>, behaves identically to
  // everything else.
  const [expanded, setExpanded] = useState(false);
  const expandBtnRef = useRef<HTMLButtonElement>(null);
  const collapseBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    // Lock page scroll behind the overlay. Restored in cleanup so unmounting
    // while expanded can't strand the page unscrollable.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    collapseBtnRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded]);

  // Return focus to the control that opened the overlay, but not on first mount.
  const wasExpanded = useRef(false);
  useEffect(() => {
    if (wasExpanded.current && !expanded) expandBtnRef.current?.focus();
    wasExpanded.current = expanded;
  }, [expanded]);

  // Bootstrap: which strategies exist and what to call them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tjss/presets");
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Request failed (${res.status})`);
        }
        const b = (await res.json()) as Bootstrap;
        if (cancelled) return;
        setBoot(b);
        setConfig({ presetId: b.presets[0]?.id ?? "default", mode: b.modes[0]?.id ?? "roundTrip" });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load strategy");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (c: ViewConfig, tf: Timeframe) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const q = new URLSearchParams({ preset: c.presetId, mode: c.mode, tf });
    try {
      const res = await fetch(`/api/tjss/market?${q}`, { signal: ctrl.signal });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      setData((await res.json()) as MarketData);
      setError(null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    const t = setTimeout(() => load(config, timeframe), 300);
    return () => clearTimeout(t);
  }, [config, timeframe, load]);

  useEffect(() => {
    if (!config) return;
    const id = setInterval(() => load(config, timeframe), 60_000);
    return () => clearInterval(id);
  }, [config, timeframe, load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* min-w-0 is required, not cosmetic. A grid item defaults to
            min-width:auto, so the column cannot shrink below its content's
            intrinsic width, and after exiting the expanded chart the canvas is
            still viewport-wide, which forced this column (and the page) to that
            width until the next resize. Same reason as the min-h-0 in TjssChart. */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Skeleton height tracks TjssChart's so the page doesn't jump on load. */}
          {loading && !data && (
            <div className="bp-surface rounded-xl h-[380px] sm:h-[440px] lg:h-[520px] max-h-[75vh] grid place-items-center text-[var(--bp-text-dim)]">
              Loading BTC + Fear &amp; Greed…
            </div>
          )}
          {error && (
            <div className="bp-surface rounded-xl p-5 text-red-400 text-sm">{error}</div>
          )}
          {data && (
            // Same element in both states so React patches className rather than
            // remounting. The chart instance, its series and the restored
            // viewport all survive expanding. `autoSize` handles the resize.
            <div
              className={
                expanded
                  ? "fixed inset-0 z-[90] overscroll-contain bg-[var(--bp-bg)] p-2 sm:p-4 flex flex-col gap-3"
                  : "bp-surface rounded-xl p-3 flex flex-col gap-3"
              }
              {...(expanded
                ? { role: "dialog" as const, "aria-modal": true, "aria-label": "Chart, expanded" }
                : {})}
            >
              {/* Timeframe + EMA controls */}
              <div className="flex flex-wrap items-center gap-3 px-1 pt-1">
                <div className="flex gap-1 rounded-lg bg-black/30 p-1">
                  {TIMEFRAMES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTimeframe(t.key)}
                      aria-pressed={timeframe === t.key}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        timeframe === t.key
                          ? "bg-[var(--bp-accent)] text-black"
                          : "text-[var(--bp-text-dim)] hover:text-white"
                      }`}
                    >
                      <span className="sm:hidden">{t.short}</span>
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(EMA_META) as EmaKey[]).map((k) => {
                    const on = emas[k];
                    const meta = EMA_META[k];
                    return (
                      <button
                        key={k}
                        onClick={() => setEmas((e) => ({ ...e, [k]: !e[k] }))}
                        aria-pressed={on}
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition"
                        style={{
                          borderColor: on ? meta.color : "var(--bp-border)",
                          color: on ? meta.color : "var(--bp-text-dim)",
                          background: on ? `${meta.color}1a` : "transparent",
                        }}
                      >
                        <span
                          className="inline-block w-3 h-0.5 rounded"
                          style={{ background: on ? meta.color : "var(--bp-text-dim)" }}
                        />
                        <span className="sm:hidden">{meta.short}</span>
                        <span className="hidden sm:inline">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Icon-only below sm to keep the toolbar to one row. The label
                    moves into aria-label so it is still announced. */}
                <button
                  ref={expanded ? collapseBtnRef : expandBtnRef}
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  aria-label={expanded ? "Exit expanded chart" : "Expand chart"}
                  title={expanded ? "Exit expanded chart (Esc)" : "Expand chart"}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--bp-border)] px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[var(--bp-text-dim)] transition hover:border-[var(--bp-border-strong)] hover:text-white"
                >
                  {expanded ? (
                    <MdFullscreenExit className="text-base" aria-hidden="true" />
                  ) : (
                    <MdFullscreen className="text-base" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">{expanded ? "Exit" : "Expand"}</span>
                </button>
              </div>
              <TjssChart
                candles={data.candles}
                fng={data.fng}
                markers={data.markers}
                regime={data.regime}
                emas={data.emas}
                visible={emas}
                levels={data.levels}
                timeframe={timeframe}
                fill={expanded}
              />
            </div>
          )}
        </div>
        {/* The rail now carries the live reading only. Strategy selection moved
            into the simulation card below, which fixed both halves of the same
            problem: the rail ran ~200px taller than the chart and left a gap,
            and choosing a mode was two scroll positions from the simulation that
            shows what it does.
            `self-start` stops the card stretching to the row height, and sticky
            keeps the current reading in view while reading the simulation. */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          {data && <SignalPanel current={data.current} />}
        </div>
      </div>

      {boot && config && (
        <BacktestPanel
          config={config}
          presets={boot.presets}
          modes={boot.modes}
          onConfigChange={setConfig}
          modeLabel={boot.modes.find((m) => m.id === config.mode)?.label ?? config.mode}
          evidence={boot.evidence}
        />
      )}
    </div>
  );
}
