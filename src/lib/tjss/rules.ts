// The TJSS v3 signal engine, single source of truth for the dashboard and the
// backtester (both consume `computeSeries`, so they never disagree).
//
// Core (always on): fear-gated weekly DCA + bearish-divergence trims.
// Optional (off by default): washout lumps, bullish-divergence lumps.
// Regime is functional: while price < the regime EMA (bear) accumulation can be
// boosted; trims can require a short-EMA roll-over to confirm.
//
// HONEST TIMING: a divergence is detected at a price pivot, but a pivot is only
// confirmable `divPivotRight` bars later. So divergence signals are made
// actionable at the CONFIRMATION bar (pivot + divPivotRight), not the pivot,
// removing look-ahead. Washout / DCA signals are same-day (real-time).

import {
  Bar,
  BarState,
  Regime,
  SignalMarker,
  SignalResult,
  SignalType,
  TjssConfig,
  classify,
  fearMultiplier,
  greedMultiplier,
} from "./types";
import { ema, divergences, Series } from "./indicators";
import { aggregate, projectOntoDaily } from "./timeframe";

export interface EngineSeries {
  n: number;
  time: number[];
  close: number[];
  fng: (number | null)[];
  regime: Regime[];
  regimeEma: Series;
  fearMult: number[];
  greedMult: number[];
  accumBoost: number[];
  isDcaDay: boolean[];
  washout: boolean[];
  // Divergence signals, indexed at their CONFIRMATION bar:
  bullDiv: boolean[];
  bullDivFng: (number | null)[]; // F&G at the pivot (bottom)
  bullDivPivot: number[]; // pivot time (0 = none)
  divTrim: boolean[];
  divTrimGreed: number[]; // greed multiplier from the pivot (top)
  divTrimFng: (number | null)[]; // F&G at the pivot (top)
  divTrimPivot: number[]; // pivot time (0 = none)
  // v4 trend layer (null before the relevant EMA is warm)
  d50: (number | null)[];
  w50: (number | null)[];
  m50: (number | null)[];
  weeklyBull: boolean[]; // confirmed weekly close above the W50
  dailyBull: boolean[]; // close above the daily 50 EMA
  deepValue: boolean[]; // close inside the M50 "bottom area"
}

/**
 * Multi-timeframe trend flags. Every higher-timeframe value is carried forward
 * only once that bar has CLOSED (projectOntoDaily), so nothing here peeks.
 */
function computeTrend(bars: Bar[], config: TjssConfig) {
  const n = bars.length;
  const len = config.trendEmaLength;
  const closes = bars.map((b) => b.close);

  const d50 = ema(closes, len) as (number | null)[];

  const weekly = aggregate(bars, "W");
  const wTimes = weekly.map((c) => c.time);
  const wEma = ema(weekly.map((c) => c.close), len) as (number | null)[];
  const w50 = projectOntoDaily(bars, "W", wTimes, wEma);

  const monthly = aggregate(bars, "M");
  const mTimes = monthly.map((c) => c.time);
  const mEma = ema(monthly.map((c) => c.close), len) as (number | null)[];
  const m50 = projectOntoDaily(bars, "M", mTimes, mEma);

  // "Bull" only once the weekly close has held above the W50 for N consecutive
  // weeks, the full-history study showed 12 of 20 raw crosses whipsawed out
  // inside a quarter, while sustained regimes held ~99% of daily closes above.
  const confirmed: (boolean | null)[] = new Array(weekly.length).fill(null);
  let streak = 0;
  for (let i = 0; i < weekly.length; i++) {
    const e = wEma[i];
    if (e == null) { confirmed[i] = null; streak = 0; continue; }
    streak = weekly[i].close > e ? streak + 1 : 0;
    confirmed[i] = streak >= config.trendConfirmWeeks;
  }
  const weeklyBullProj = projectOntoDaily(bars, "W", wTimes, confirmed);

  const weeklyBull = new Array<boolean>(n).fill(false);
  const dailyBull = new Array<boolean>(n).fill(false);
  const deepValue = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    weeklyBull[i] = weeklyBullProj[i] === true;
    dailyBull[i] = d50[i] != null && closes[i] > (d50[i] as number);
    deepValue[i] = m50[i] != null && closes[i] <= (m50[i] as number) * config.deepValueMult;
  }
  return { d50, w50, m50, weeklyBull, dailyBull, deepValue };
}

export function computeSeries(bars: Bar[], config: TjssConfig): EngineSeries {
  const n = bars.length;
  const time = bars.map((b) => b.time);
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume);
  const fng = bars.map((b) => b.fng);
  const right = config.divPivotRight;

  const regimeEma = ema(close, config.regimeLength);
  const confirmEma = ema(close, config.trimConfirmLength);
  const { bullish, bearish } = divergences(close, fng, config.divPivotLeft, right);

  const volSma = new Array<number | null>(n).fill(null);
  {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += volume[i];
      if (i >= config.volLength) sum -= volume[i - config.volLength];
      if (i >= config.volLength - 1) volSma[i] = sum / config.volLength;
    }
  }

  const regime = new Array<Regime>(n);
  const fearMult = new Array<number>(n).fill(0);
  const greedMult = new Array<number>(n).fill(0);
  const accumBoost = new Array<number>(n).fill(1);
  const isDcaDay = new Array<boolean>(n).fill(false);
  const washout = new Array<boolean>(n).fill(false);

  const trend = computeTrend(bars, config);

  for (let i = 0; i < n; i++) {
    // Regime: the W50 weekly trend when the trend layer is on, else the legacy
    // long-EMA filter.
    const e = regimeEma[i];
    const isBear =
      config.useTrend && config.trendRegime
        ? !trend.weeklyBull[i]
        : config.useRegime && e != null && close[i] < e;
    regime[i] = isBear ? "bear" : "bull";
    accumBoost[i] = isBear ? config.bearAccumBoost : 1;
    // Cycle bottoms sat just under the M50, buy harder inside that zone.
    // Tranched: scale with depth so the top of the zone (which can still fall
    // a long way) doesn't get the full size.
    if (config.useTrend && isBear && trend.deepValue[i]) {
      const m = trend.m50[i];
      if (config.deepValueTranche && m != null && m > 0) {
        const ratio = close[i] / m;
        const top = config.deepValueMult;
        const span = top - config.deepValueFloor;
        const t = span > 0 ? Math.min(1, Math.max(0, (top - ratio) / span)) : 1;
        accumBoost[i] *= 1 + t * (config.deepValueBoost - 1);
      } else {
        accumBoost[i] *= config.deepValueBoost;
      }
    }

    const f = fng[i];
    if (f != null) {
      fearMult[i] = fearMultiplier(f, config.fearWeightMax, config.dcaFearCap);
      greedMult[i] = greedMultiplier(f, config.trimGreedFloor, config.greedWeightMax);
      isDcaDay[i] = i % config.dcaCadenceDays === 0 && f <= config.dcaFearCap;

      if (i > 0 && close[i - 1] > 0) {
        const dayRet = close[i] / close[i - 1] - 1;
        const volSpike =
          !config.useVolume ||
          (volSma[i] != null && volume[i] > (volSma[i] as number) * config.volMultiplier);
        washout[i] = dayRet <= config.washoutDayPct && f <= config.washoutFngMax && volSpike;
      }
    }
  }

  // Divergences become actionable at pivot + right (the confirmation bar).
  const bullDiv = new Array<boolean>(n).fill(false);
  const bullDivFng = new Array<number | null>(n).fill(null);
  const bullDivPivot = new Array<number>(n).fill(0);
  const divTrim = new Array<boolean>(n).fill(false);
  const divTrimGreed = new Array<number>(n).fill(0);
  const divTrimFng = new Array<number | null>(n).fill(null);
  const divTrimPivot = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    const f = fng[i];
    if (bullish[i]) {
      const j = i + right;
      if (j < n) {
        bullDiv[j] = true;
        bullDivFng[j] = f;
        bullDivPivot[j] = time[i];
      }
    }
    if (bearish[i] && f != null && f >= config.trimGreedFloor) {
      const j = i + right;
      if (j < n) {
        const ce = confirmEma[j];
        let ok = !config.trimConfirm || (ce != null && close[j] < ce);
        // T3: the daily-50 break led every weekly breakdown, so require that
        // early warning before acting on a top.
        if (ok && config.useTrend && config.trendArmTrims) ok = !trend.dailyBull[j];
        if (ok) {
          divTrim[j] = true;
          divTrimGreed[j] = greedMultiplier(f, config.trimGreedFloor, config.greedWeightMax);
          divTrimFng[j] = f;
          divTrimPivot[j] = time[i];
        }
      }
    }
  }

  return {
    n, time, close, fng, regime, regimeEma, fearMult, greedMult, accumBoost,
    isDcaDay, washout,
    bullDiv, bullDivFng, bullDivPivot,
    divTrim, divTrimGreed, divTrimFng, divTrimPivot,
    d50: trend.d50, w50: trend.w50, m50: trend.m50,
    weeklyBull: trend.weeklyBull, dailyBull: trend.dailyBull, deepValue: trend.deepValue,
  };
}

const LUMP_GUIDE = 0.25;
const lumpSize = (boost: number) => Math.min(1, LUMP_GUIDE * boost);
const trimSize = (greedM: number) => Math.min(1, 0.4 * greedM);
const fmtDay = (t: number) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "");

export function computeSignals(bars: Bar[], config: TjssConfig): SignalResult {
  const s = computeSeries(bars, config);
  const { n } = s;
  const markers: SignalMarker[] = [];
  const states: BarState[] = [];

  for (let i = 0; i < n; i++) {
    const signals: SignalType[] = [];

    if (s.bullDiv[i]) {
      signals.push("divLump");
      markers.push({
        time: s.time[i], type: "divLump", fng: s.bullDivFng[i], price: s.close[i],
        size: lumpSize(s.accumBoost[i]),
        reason: `Bullish divergence, price low formed ${fmtDay(s.bullDivPivot[i])}, confirmed at this bar`,
      });
    }
    if (s.washout[i]) {
      signals.push("washoutLump");
      markers.push({
        time: s.time[i], type: "washoutLump", fng: s.fng[i], price: s.close[i],
        size: lumpSize(s.accumBoost[i]),
        reason: `Large single-day decline recorded in fear`,
      });
    }
    if (s.divTrim[i]) {
      signals.push("divTrim");
      markers.push({
        time: s.time[i], type: "divTrim", fng: s.divTrimFng[i], price: s.close[i],
        size: trimSize(s.divTrimGreed[i]),
        reason: `Bearish divergence, price high formed ${fmtDay(s.divTrimPivot[i])} at F&G ${s.divTrimFng[i]}, confirmed at this bar`,
      });
    }

    const f = s.fng[i];
    states.push({
      time: s.time[i],
      fng: f,
      classification: f != null ? classify(f) : null,
      regime: s.regime[i],
      regimeEma: s.regimeEma[i],
      signals,
      weeklyBull: s.weeklyBull[i],
      dailyBull: s.dailyBull[i],
      deepValue: s.deepValue[i],
    });
  }

  markers.sort((a, b) => a.time - b.time);
  const current = buildCurrent(s, config, markers);
  return { bars: states, markers, current };
}

function buildCurrent(
  s: EngineSeries,
  config: TjssConfig,
  markers: SignalMarker[]
): SignalResult["current"] {
  // Report as at the last COMPLETE bar, one that has both a price and a
  // sentiment reading, rather than whichever bar is newest.
  //
  // Price and F&G come from different providers on different cadences, so the
  // newest bar routinely has a close and no index value yet. Anchoring to the
  // newest bar made the whole panel blank out in that window. Anchoring to the
  // last complete bar and labelling it with its own date is both more robust and
  // more honest: this is published research reported as at a stated date, not a
  // live tape.
  let i = s.n - 1;
  while (i > 0 && s.fng[i] == null) i--;

  const f = s.fng[i];
  const regime = s.regime[i] ?? "bull";
  const lastSignal = markers.length ? markers[markers.length - 1] : null;

  const window = config.divPivotRight + 5;
  const cutoff = Math.max(0, i - window);
  let recentBull = false;
  let recentBullAt = 0;
  let recentTrimGreed = 0;
  let recentTrimAt = 0;
  for (let k = cutoff; k <= i; k++) {
    if (s.bullDiv[k]) { recentBull = true; recentBullAt = s.time[k]; }
    if (s.divTrim[k]) { recentTrimGreed = s.divTrimGreed[k]; recentTrimAt = s.time[k]; }
  }
  const recentTrim = recentTrimGreed > 0;

  let target = f != null ? Math.min(1, Math.max(0, 1 - f / 100 + 0.2)) : 0.5;
  if (recentBull || s.washout[i]) target = 1;
  if (recentTrim) target = config.allocationMode === "accumulate" ? target : 0.2;
  target = Math.min(1, Math.max(0, target));

  const bear = regime === "bear";
  const regimeLabel = bear ? "Bear regime" : "Bull regime";
  // ---------------------------------------------------------------------
  // MEMBER-FACING COPY, read this before editing any string below.
  //
  // These strings must describe WHAT THE DOCUMENTED RULESET DID, never what
  // the reader should do. Two rules, both deliberate:
  //
  //   1. No imperatives. "ACCUMULATE" / "TRIM" / "HOLD" read as instructions
  //      to a specific person about a specific asset. The equivalent
  //      observation ("Rule state: accumulation band") carries the same
  //      information without recommending anything.
  //   2. No parameters. No multiplier, threshold or fraction, those live in
  //      Mongo and stay server-side.
  //
  // The dashboard is published research, not advice. Reintroducing a verb in
  // the second person undoes that. See research/compliance/review-pack.md.
  // ---------------------------------------------------------------------
  const boosted = s.accumBoost[i] > 1;
  const deep = boosted ? " · price is deep below its long-term trend" : "";
  let action: string;
  let detail: string;

  if (recentTrim && config.allocationMode !== "accumulate") {
    action = "Rule state: distribution band";
    detail = `${regimeLabel} · bearish sentiment divergence confirmed ${fmtDay(recentTrimAt)}`;
  } else if (s.washout[i]) {
    action = "Rule state: accumulation band";
    detail = `${regimeLabel} · large single-day decline recorded in fear (F&G ${f})${deep}`;
  } else if (recentBull) {
    action = "Rule state: accumulation band";
    detail = `${regimeLabel} · bullish sentiment divergence confirmed ${fmtDay(recentBullAt)}${deep}`;
  } else if (f != null && f <= config.dcaFearCap) {
    action = "Rule state: accumulation band";
    detail = `${regimeLabel} · F&G ${f} (${classify(f)})${deep}`;
  } else if (f != null) {
    action = "Rule state: neutral";
    detail = `${regimeLabel} · F&G ${f} (${classify(f)}) · no rule trigger recorded`;
  } else {
    action = "Rule state: unavailable";
    detail = `${regimeLabel} · awaiting Fear & Greed data`;
  }

  return {
    time: s.time[i] ?? 0,
    price: s.close[i] ?? 0,
    fng: f,
    classification: f != null ? classify(f) : null,
    regime,
    targetExposure: target,
    action,
    detail,
    lastSignal,
    trend: {
      weeklyBull: s.weeklyBull[i],
      dailyBull: s.dailyBull[i],
      deepValue: s.deepValue[i],
      d50: s.d50[i],
      w50: s.w50[i],
      m50: s.m50[i],
    },
  };
}
