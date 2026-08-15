"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  LineStyle,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type SeriesMarker,
  type LogicalRange,
} from "lightweight-charts";
import type { SignalType, Regime, Candle } from "@/lib/tjss/types";

// Presentational only.
//
// Aggregation, F&G bucketing, regime collapsing and EMA projection all used to
// run here, which put that math, and the EMA length it needs, in the public
// browser bundle. The server now sends points already shaped for the selected
// timeframe; this component plots what it is given.

export type ChartCandle = Candle;
export interface ChartFng { time: number; value: number; }
export interface RegimePoint { time: number; regime: Regime; }
export interface EmaSeries { key: EmaKey; points: { time: number; value: number }[] }
export type EmaKey = "daily" | "weekly" | "monthly";
export type EmaToggles = Record<EmaKey, boolean>;

export interface ChartMarker {
  bucketTime: number;
  time: number;
  type: SignalType;
  fng: number | null;
  price: number;
  size: number;
  reason: string;
}

interface Props {
  candles: ChartCandle[]; // already aggregated to the displayed timeframe
  fng: ChartFng[];
  markers: ChartMarker[];
  regime: RegimePoint[];
  /** All overlays, always sent. Toggling `visible` then costs no round-trip and
   *  preserves the current zoom/pan. */
  emas: EmaSeries[];
  visible: EmaToggles;
  levels: { fear: number; greed: number };
  /** Which timeframe the candles were aggregated to. Used only to decide when a
   *  saved viewport is still meaningful, see `savedRangeRef`. */
  timeframe: string;
  /** Grow to fill the parent instead of the fixed inline height. */
  fill?: boolean;
}

const GREEN = "#22c55e";
const DGREEN = "#16a34a";
const RED = "#ef4444";

// `short` is used below the sm breakpoint, where the three full labels total
// ~406px against ~311px of usable width at 375px and wrap the toolbar to three
// rows. Deliberately NOT "Daily"/"Weekly"/"Monthly", the timeframe buttons
// immediately to the left already read exactly that, and two adjacent controls
// with identical labels is a worse problem than the overflow.
export const EMA_META: Record<EmaKey, { label: string; short: string; color: string }> = {
  daily: { label: "Daily trend EMA", short: "D EMA", color: "#38bdf8" },
  weekly: { label: "Weekly trend EMA", short: "W EMA", color: "#f59e0b" },
  monthly: { label: "Monthly trend EMA", short: "M EMA", color: "#a78bfa" },
};

// Marker titles name the CONDITION the ruleset detected, not an action to take.
const TITLE: Record<SignalType, string> = {
  divLump: "Bullish sentiment divergence",
  washoutLump: "Single-day decline in fear",
  divTrim: "Bearish sentiment divergence",
  dcaBuy: "Scheduled interval",
};

function toMarker(m: ChartMarker): SeriesMarker<Time> {
  const time = m.bucketTime as Time;
  if (m.type === "divTrim") return { time, position: "aboveBar", color: RED, shape: "arrowDown" };
  if (m.type === "washoutLump") return { time, position: "belowBar", color: DGREEN, shape: "circle" };
  return { time, position: "belowBar", color: GREEN, shape: "arrowUp" };
}

const fmtDate = (t: number) =>
  new Date(t * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// Past tense, and about the model. "Deploy ~25% of dry powder" instructs the
// reader; "model allocated 25% of undeployed cash" reports what the ruleset did.
function tooltipHtml(list: ChartMarker[]): string {
  return list
    .map((m) => {
      const color = m.type === "divTrim" ? RED : GREEN;
      const pct = Math.round(m.size * 100);
      const size =
        m.type === "divTrim"
          ? `Model reduced ~${pct}% of the position`
          : `Model allocated ~${pct}% of undeployed cash`;
      return `
        <div style="margin-bottom:6px">
          <div style="font-weight:600;color:${color}">${TITLE[m.type]}</div>
          <div style="color:#a1a1aa">${fmtDate(m.time)} · F&amp;G ${m.fng ?? "—"} · $${m.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div style="color:#fafafa">${size}</div>
          <div style="color:#a1a1aa">${m.reason}</div>
        </div>`;
    })
    .join("");
}

function LegendItem({ glyph, color, label }: { glyph: string; color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--bp-text-dim)]">
      <span style={{ color }}>{glyph}</span>
      {label}
    </span>
  );
}

export default function TjssChart({
  candles, fng, markers, regime, emas, visible, levels, timeframe, fill,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const emaSeriesRef = useRef<Partial<Record<EmaKey, ISeriesApi<"Line">>>>({});

  // The 60s poll hands down a whole new data object, so every prop below changes
  // identity and this effect tears the chart down and rebuilds it. Without the
  // range below, that rebuild ended in fitContent() and threw away the user's
  // zoom and pan once a minute.
  //
  // Logical ranges are indices into the bar array, so one captured on ~3,300
  // daily bars is meaningless against ~470 weekly ones. `rangeTfRef` records
  // which timeframe the saved range belongs to; a D→W→M switch discards it and
  // refits instead.
  const savedRangeRef = useRef<LogicalRange | null>(null);
  const rangeTfRef = useRef<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "inherit",
        panes: { separatorColor: "rgba(255,255,255,0.09)" },
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.09)" },
      timeScale: { borderColor: "rgba(255,255,255,0.09)", rightOffset: 4 },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: GREEN, downColor: RED, wickUpColor: GREEN, wickDownColor: RED, borderVisible: false,
    });
    candleSeries.setData(
      candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
    );
    chart.priceScale("right").applyOptions({ mode: PriceScaleMode.Logarithmic });
    createSeriesMarkers(candleSeries, markers.map(toMarker));

    // EMA overlays, pre-projected by the server. All are created up front and
    // shown/hidden by the effect below, so a toggle never rebuilds the chart.
    emaSeriesRef.current = {};
    for (const series of emas) {
      const meta = EMA_META[series.key];
      if (!meta || !series.points.length) continue;
      const line = chart.addSeries(LineSeries, {
        color: meta.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
        title: meta.label,
      });
      line.setData(series.points.map((p) => ({ time: p.time as Time, value: p.value })));
      emaSeriesRef.current[series.key] = line;
    }

    // Fear & Greed pane with the regime ribbon behind it.
    const band = chart.addSeries(
      HistogramSeries,
      { priceScaleId: "fng", priceLineVisible: false, lastValueVisible: false, base: 0 },
      1
    );
    band.setData(
      regime.map((r) => ({
        time: r.time as Time,
        value: 100,
        color: r.regime === "bull" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
      }))
    );

    const fngSeries = chart.addSeries(
      LineSeries,
      { priceScaleId: "fng", color: "#ff6719", lineWidth: 2, priceLineVisible: false, lastValueVisible: true },
      1
    );
    fngSeries.setData(fng.map((f) => ({ time: f.time as Time, value: f.value })));
    fngSeries.createPriceLine({ price: levels.fear, color: GREEN, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: `Fear ${levels.fear}` });
    fngSeries.createPriceLine({ price: levels.greed, color: RED, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: `Greed ${levels.greed}` });
    chart.priceScale("fng", 1).applyOptions({ borderColor: "rgba(255,255,255,0.09)" });

    const panes = chart.panes();
    if (panes[0]) panes[0].setStretchFactor(3);
    if (panes[1]) panes[1].setStretchFactor(1);

    // Restore the viewport the user was looking at, unless it belongs to a
    // different timeframe (or there isn't one yet), in which case fit the range.
    const saved = rangeTfRef.current === timeframe ? savedRangeRef.current : null;
    if (saved) {
      chart.timeScale().setVisibleLogicalRange(saved);
    } else {
      chart.timeScale().fitContent();
    }

    // Hover tooltip, keyed by the bucket the server assigned each marker.
    const byTime = new Map<number, ChartMarker[]>();
    for (const m of markers) {
      const arr = byTime.get(m.bucketTime);
      if (arr) arr.push(m);
      else byTime.set(m.bucketTime, [m]);
    }
    chart.subscribeCrosshairMove((param) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      const list = param.time != null ? byTime.get(param.time as number) : undefined;
      if (!list || !param.point) {
        tip.style.display = "none";
        return;
      }
      tip.innerHTML = tooltipHtml(list);
      tip.style.display = "block";
      const left = Math.min(param.point.x + 14, el.clientWidth - tip.clientWidth - 12);
      tip.style.left = `${Math.max(8, left)}px`;
      tip.style.top = `${Math.max(8, param.point.y - 10)}px`;
    });

    return () => {
      // Capture before remove(). The chart is unusable afterwards.
      savedRangeRef.current = chart.timeScale().getVisibleLogicalRange();
      rangeTfRef.current = timeframe;
      chart.remove();
      chartRef.current = null;
      emaSeriesRef.current = {};
    };
  }, [candles, fng, markers, regime, emas, levels, timeframe]);

  // Show/hide overlays without touching the chart's data or viewport.
  useEffect(() => {
    if (!chartRef.current) return;
    for (const key of Object.keys(EMA_META) as EmaKey[]) {
      emaSeriesRef.current[key]?.applyOptions({ visible: !!visible[key] });
    }
  }, [visible, emas]);

  return (
    // `min-h-0` on both flex wrappers is load-bearing when filling: a flex child
    // defaults to min-height:auto and refuses to shrink below its content, which
    // would push the chart past the viewport and produce a scrollbar rather than
    // a fit. The legend keeps its intrinsic height; the chart takes the rest.
    <div className={`flex flex-col gap-2${fill ? " flex-1 min-h-0" : ""}`}>
      <div className={`relative${fill ? " flex-1 min-h-0" : ""}`}>
        {/* max-h-[75vh] is what rescues phone-landscape, where the viewport is
            ~390px tall and any fixed pixel height overflows it. */}
        <div
          ref={containerRef}
          className={
            fill
              ? "h-full w-full"
              : "h-[380px] sm:h-[440px] lg:h-[520px] max-h-[75vh] w-full"
          }
        />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-10 hidden max-w-[260px] rounded-lg border border-[var(--bp-border-strong)] bg-[var(--bp-surface-2)] px-3 py-2 text-xs shadow-xl"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs">
        <LegendItem glyph="▲" color={GREEN} label="Bullish divergence" />
        <LegendItem glyph="●" color={DGREEN} label="Decline in fear" />
        <LegendItem glyph="▼" color={RED} label="Bearish divergence" />
        {emas
          .filter((s) => visible[s.key] && s.points.length)
          .map((s) => (
            <LegendItem key={s.key} glyph="—" color={EMA_META[s.key].color} label={EMA_META[s.key].label} />
          ))}
        <span className="inline-flex items-center gap-1.5 text-[var(--bp-text-dim)]">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(34,197,94,0.35)" }} />
          Bull regime
        </span>
        <span className="inline-flex items-center gap-1.5 text-[var(--bp-text-dim)]">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(239,68,68,0.35)" }} />
          Bear regime
        </span>
        {/* Deliberately different wording on touch. "Hover" is meaningless
            without a pointer, and the crosshair needs a press-and-drag there,
            better to describe that than to promise a smooth interaction. */}
        <span className="text-[var(--bp-text-dim)] sm:hidden">
         , press and drag on a marker for details
        </span>
        <span className="hidden text-[var(--bp-text-dim)] sm:inline">
         , hover a marker for details
        </span>
      </div>
    </div>
  );
}
