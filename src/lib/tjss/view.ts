import "server-only";
import type { Bar, Candle, Regime, SignalResult, SignalType, TjssConfig } from "./types";
import { aggregate, bucketStart, bucketLast, projectEma, type Timeframe } from "./timeframe";

// Builds the display-ready payload for the chart.
//
// This work used to happen in TjssChart.tsx, which meant the aggregation and
// EMA-projection code shipped to the browser and the client needed to know the
// EMA length to draw anything. Doing it here keeps every strategy input on the
// server: the client receives points to plot and nothing it could work
// backwards from.

export type EmaKey = "daily" | "weekly" | "monthly";

const EMA_SOURCE: Record<EmaKey, Timeframe> = { daily: "D", weekly: "W", monthly: "M" };

export interface ViewMarker {
  /** Bucket the marker is drawn in (matches a candle time on this timeframe). */
  bucketTime: number;
  /** True signal date, shown in the tooltip. */
  time: number;
  type: SignalType;
  fng: number | null;
  price: number;
  size: number;
  reason: string;
}

export interface ChartView {
  candles: Candle[];
  fng: { time: number; value: number }[];
  /** One entry per displayed candle that has a known regime. */
  regime: { time: number; regime: Regime }[];
  markers: ViewMarker[];
  emas: { key: EmaKey; points: { time: number; value: number }[] }[];
  /** Reference lines for the F&G pane. */
  levels: { fear: number; greed: number };
}

const ALL_EMA_KEYS = Object.keys(EMA_SOURCE) as EmaKey[];

/**
 * All three EMA overlays are always projected. They are cheap relative to the
 * signal pass, and sending them together lets the client toggle an overlay
 * without a round-trip, which is what preserves the chart's zoom.
 */
export function buildChartView(
  bars: Bar[],
  signals: SignalResult,
  config: TjssConfig,
  tf: Timeframe
): ChartView {
  const daily: Candle[] = bars.map((b) => ({
    time: b.time,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
  const candles = aggregate(daily, tf);
  const displayTimes = new Set(candles.map((c) => c.time));

  const fng = bucketLast(
    bars.filter((b) => b.fng != null).map((b) => ({ time: b.time, value: b.fng as number })),
    tf
  ).map((p) => ({ time: p.time, value: p.value }));

  // Regime per displayed bucket (last value in the bucket wins), dropped to one
  // entry per candle so the client can paint the ribbon without re-bucketing.
  const regimeByBucket = new Map<number, Regime>();
  for (const st of signals.bars) regimeByBucket.set(bucketStart(st.time, tf), st.regime);
  const regime = candles
    .map((c) => ({ time: c.time, regime: regimeByBucket.get(c.time) }))
    .filter((r): r is { time: number; regime: Regime } => r.regime != null);

  const markers: ViewMarker[] = signals.markers.map((m) => ({
    bucketTime: bucketStart(m.time, tf),
    time: m.time,
    type: m.type,
    fng: m.fng,
    price: m.price,
    size: m.size,
    reason: m.reason,
  }));

  const emas = ALL_EMA_KEYS.map((key) => ({
    key,
    points: projectEma(daily, EMA_SOURCE[key], config.trendEmaLength, tf).filter((p) =>
      displayTimes.has(p.time)
    ),
  }));

  return {
    candles,
    fng,
    regime,
    markers,
    emas,
    levels: { fear: config.fearThreshold, greed: config.greedThreshold },
  };
}
