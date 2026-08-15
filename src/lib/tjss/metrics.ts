// Risk metrics computed from an equity curve.
//
// Total return and max drawdown are two points on a distribution; they say
// nothing about how the path felt. A strategy that spends four years underwater
// to arrive at the same place is not the same product, and the pain metrics
// below are where TJSS's actual behaviour shows up.

export interface EquityCurvePoint {
  time: number;
  equity: number;
}

export interface RiskMetrics {
  /** Annualised mean/sd of daily returns. Risk-free assumed 0. */
  sharpe: number;
  /** Same, but only downside deviation is charged as risk. */
  sortino: number;
  /** RMS drawdown depth, penalises long shallow pain, not just the worst day. */
  ulcerIndex: number;
  /** CAGR ÷ ulcer index. Return per unit of *sustained* pain. */
  martinRatio: number;
  /** Share of bars spent below a prior peak. */
  timeUnderwaterPct: number;
  /** Longest unbroken stretch below a prior peak, in bars. */
  longestDrawdownDays: number;
  /** Bars from the deepest trough back to the prior peak. null = never recovered. */
  recoveryDays: number | null;
  /** Worst single-bar return, percent. */
  worstDayPct: number;
  /** Annualised standard deviation of daily returns, percent. */
  volatilityPct: number;
}

const TRADING_DAYS = 365; // crypto trades every day

/**
 * All metrics come off the same single pass over daily returns and the running
 * peak, so they are internally consistent, the drawdown that produces the
 * ulcer index is the same one that produces time-underwater.
 */
export function computeRiskMetrics(equity: EquityCurvePoint[]): RiskMetrics {
  const empty: RiskMetrics = {
    sharpe: 0, sortino: 0, ulcerIndex: 0, martinRatio: 0,
    timeUnderwaterPct: 0, longestDrawdownDays: 0, recoveryDays: null,
    worstDayPct: 0, volatilityPct: 0,
  };
  if (equity.length < 3) return empty;

  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1].equity;
    if (prev > 0) returns.push(equity[i].equity / prev - 1);
  }
  if (!returns.length) return empty;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  const sd = Math.sqrt(variance);
  // Downside deviation charges only returns below zero, so a strategy is not
  // penalised for the upside volatility everyone actually wants.
  const downside = returns.filter((r) => r < 0);
  const dd = downside.length
    ? Math.sqrt(downside.reduce((a, r) => a + r * r, 0) / downside.length)
    : 0;

  const annMean = mean * TRADING_DAYS;
  const annSd = sd * Math.sqrt(TRADING_DAYS);
  const annDd = dd * Math.sqrt(TRADING_DAYS);

  // Drawdown pass.
  let peak = equity[0].equity;
  let sumSqDd = 0;
  let underwater = 0;
  let currentRun = 0;
  let longestRun = 0;
  let worstDd = 0;
  let troughIdx = 0;
  let peakAtTrough = peak;

  for (let i = 0; i < equity.length; i++) {
    const e = equity[i].equity;
    if (e > peak) {
      peak = e;
      currentRun = 0;
    } else {
      currentRun++;
      if (currentRun > longestRun) longestRun = currentRun;
      underwater++;
    }
    const drop = peak > 0 ? (e - peak) / peak : 0;
    sumSqDd += drop * drop;
    if (drop < worstDd) {
      worstDd = drop;
      troughIdx = i;
      peakAtTrough = peak;
    }
  }

  // Time from the deepest trough back to the level that preceded it.
  let recoveryDays: number | null = null;
  for (let i = troughIdx + 1; i < equity.length; i++) {
    if (equity[i].equity >= peakAtTrough) {
      recoveryDays = i - troughIdx;
      break;
    }
  }

  const ulcer = Math.sqrt(sumSqDd / equity.length) * 100;
  const years = (equity[equity.length - 1].time - equity[0].time) / (365.25 * 86400);
  const growth = equity[0].equity > 0 ? equity[equity.length - 1].equity / equity[0].equity : 0;
  const cagr = years > 0 && growth > 0 ? (Math.pow(growth, 1 / years) - 1) * 100 : 0;

  return {
    sharpe: annSd > 0 ? annMean / annSd : 0,
    sortino: annDd > 0 ? annMean / annDd : 0,
    ulcerIndex: ulcer,
    martinRatio: ulcer > 0 ? cagr / ulcer : 0,
    timeUnderwaterPct: (underwater / equity.length) * 100,
    longestDrawdownDays: longestRun,
    recoveryDays,
    worstDayPct: Math.min(...returns) * 100,
    volatilityPct: annSd * 100,
  };
}
