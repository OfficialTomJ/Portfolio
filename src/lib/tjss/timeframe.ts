// Timeframe aggregation + multi-timeframe (MTF) indicator projection.
//
// Pure and client-safe (no server imports), so the dashboard can re-bucket the
// daily candles it already has into weekly/monthly views and draw higher-
// timeframe EMAs without another round-trip. The engine can reuse these helpers
// when the EMAs are folded into the strategy.
//
// No look-ahead: a higher-timeframe EMA is only carried onto lower-timeframe
// bars once that higher-timeframe bar has CLOSED, the same discipline applied
// to divergence confirmation in rules.ts.

import { Candle } from "./types";
import { ema, Series } from "./indicators";

export type Timeframe = "D" | "W" | "M";

const DAY = 86400;

/** Start of the UTC period containing `time` (weeks start Monday). */
export function bucketStart(time: number, tf: Timeframe): number {
  if (tf === "D") return Math.floor(time / DAY) * DAY;
  const d = new Date(time * 1000);
  if (tf === "W") {
    const dow = d.getUTCDay(); // 0 = Sunday
    const backToMonday = (dow + 6) % 7;
    return Math.floor(time / DAY) * DAY - backToMonday * DAY;
  }
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}

/**
 * Aggregate daily candles into weekly/monthly buckets.
 * open = first, high = max, low = min, close = last, volume = sum,
 * time = bucket start. Input must be ascending by time.
 */
export function aggregate(candles: Candle[], tf: Timeframe): Candle[] {
  if (tf === "D") return candles;
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let curKey = -1;
  for (const c of candles) {
    const key = bucketStart(c.time, tf);
    if (!cur || key !== curKey) {
      if (cur) out.push(cur);
      cur = { time: key, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
      curKey = key;
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume += c.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Collapse a daily-indexed value series onto `tf` buckets, keeping the LAST
 * value in each bucket (used for the F&G line and the regime ribbon).
 */
export function bucketLast<T>(
  points: { time: number; value: T }[],
  tf: Timeframe
): { time: number; value: T }[] {
  if (tf === "D") return points;
  const byBucket = new Map<number, T>();
  for (const p of points) byBucket.set(bucketStart(p.time, tf), p.value);
  return Array.from(byBucket.entries())
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time - b.time);
}

export interface EmaPoint {
  time: number;
  value: number;
}

/**
 * Project a series computed on `sourceTf` onto daily bars, carrying the last
 * CLOSED source bar forward. Returns one entry per daily bar (null until the
 * first source bar has closed), the shared no-look-ahead primitive behind
 * both the chart EMAs and the strategy's trend flags.
 */
export function projectOntoDaily<T>(
  dailyCandles: Candle[],
  sourceTf: Timeframe,
  sourceTimes: number[],
  sourceValues: (T | null)[]
): (T | null)[] {
  const pts: { start: number; value: T }[] = [];
  for (let i = 0; i < sourceTimes.length; i++) {
    const v = sourceValues[i];
    if (v != null) pts.push({ start: sourceTimes[i], value: v });
  }
  const out: (T | null)[] = new Array(dailyCandles.length).fill(null);
  if (pts.length === 0) return out;
  let si = -1;
  for (let i = 0; i < dailyCandles.length; i++) {
    const bucket = bucketStart(dailyCandles[i].time, sourceTf);
    while (si + 1 < pts.length && bucket > pts[si + 1].start) si++;
    if (si >= 0) out[i] = pts[si].value;
  }
  return out;
}

/**
 * Compute a `length`-period EMA on `sourceTf` and project it onto bars of
 * `displayTf`.
 *
 * - source timeframe HIGHER than display (e.g. weekly EMA on a daily chart):
 *   the value of a higher-timeframe bar is only applied to display bars that
 *   fall AFTER that bar closed, so nothing is drawn from unclosed data.
 * - source timeframe EQUAL to display: plotted directly.
 * - source timeframe LOWER than display (e.g. daily EMA on a monthly chart):
 *   take the source value at each display bucket's last bar.
 */
export function projectEma(
  dailyCandles: Candle[],
  sourceTf: Timeframe,
  length: number,
  displayTf: Timeframe
): EmaPoint[] {
  const sourceCandles = aggregate(dailyCandles, sourceTf);
  const values = ema(sourceCandles.map((c) => c.close), length);

  // Pair each source bar with its EMA value (skipping warm-up nulls).
  const sourcePoints: { start: number; value: number }[] = [];
  sourceCandles.forEach((c, i) => {
    const v = (values as Series)[i];
    if (v != null) sourcePoints.push({ start: c.time, value: v });
  });
  if (sourcePoints.length === 0) return [];

  const displayCandles = aggregate(dailyCandles, displayTf);
  const rank = { D: 0, W: 1, M: 2 } as const;

  if (rank[sourceTf] === rank[displayTf]) {
    return sourcePoints.map((p) => ({ time: p.start, value: p.value }));
  }

  if (rank[sourceTf] > rank[displayTf]) {
    // Higher TF onto lower TF. A source bar starting at S closes at the start of
    // the next source bar, so its value may only be used from that moment on.
    //
    // Emit a point only where the value CHANGES, rather than one per display
    // bar. Repeating the held value on every bar drew a staircase, the weekly
    // EMA was 2,939 points carrying 420 distinct values, so 86% of the line was
    // flat treads and vertical risers. Plotting only the transitions lets the
    // renderer join them, which is the smooth line people expect from a
    // higher-timeframe average.
    //
    // This does NOT introduce look-ahead: each value still appears at the first
    // display bar on which it was known, exactly as before. Only the redundant
    // in-between points are dropped, so the slope drawn between two transitions
    // is a rendering artefact rather than a claim about what was known when.
    // (`projectOntoDaily`, which feeds the strategy's trend flags, is untouched
    // and still step-holds, a rule input must not be interpolated.)
    const out: EmaPoint[] = [];
    let si = -1;
    let last: number | null = null;
    for (const c of displayCandles) {
      while (
        si + 1 < sourcePoints.length &&
        bucketStart(c.time, sourceTf) > sourcePoints[si + 1].start
      ) {
        si++;
      }
      if (si < 0) continue;
      const v = sourcePoints[si].value;
      if (v !== last) {
        out.push({ time: c.time, value: v });
        last = v;
      }
    }
    // Anchor the final value at the last display bar so the line reaches the
    // right edge instead of stopping at its most recent transition.
    const lastCandle = displayCandles[displayCandles.length - 1];
    if (last != null && lastCandle && out[out.length - 1].time !== lastCandle.time) {
      out.push({ time: lastCandle.time, value: last });
    }
    return out;
  }

  // Lower TF onto higher TF: value at each display bucket's last source bar.
  const byBucket = new Map<number, number>();
  for (const p of sourcePoints) byBucket.set(bucketStart(p.start, displayTf), p.value);
  const out: EmaPoint[] = [];
  for (const c of displayCandles) {
    const v = byBucket.get(c.time);
    if (v != null) out.push({ time: c.time, value: v });
  }
  return out;
}
