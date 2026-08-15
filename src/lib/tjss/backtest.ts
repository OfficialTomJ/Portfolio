// TJSS v3 backtester. Replays computeSeries and simulates the strategy:
//   - flat/fear-weighted weekly DCA, boosted in bear regime;
//   - optional washout / bullish-divergence lumps, each CAPPED (ladder in);
//   - confirmed bearish-divergence trims (greed-scaled), gated by mode.
// Produces an equity curve vs buy-and-hold, a tagged trade log, and stats
// including MAR (CAGR / |max drawdown|).

import { Bar, BacktestConfig, BacktestResult, EquityPoint, Trade } from "./types";
import { computeSeries } from "./rules";

const DAY = 86400;
const toDate = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

/**
 * Money-weighted annual return (IRR) from dated cashflows, by bisection.
 * Needed because CAGR silently lies once capital is added over time.
 */
function irr(flows: { t: number; amount: number }[], finalValue: number, endT: number): number {
  if (!flows.length || finalValue <= 0) return 0;
  const npv = (rate: number) => {
    let v = -finalValue;
    for (const f of flows) {
      const years = (endT - f.t) / (365.25 * DAY);
      v += f.amount * Math.pow(1 + rate, years);
    }
    return v;
  };
  let lo = -0.95, hi = 10;
  if (npv(lo) * npv(hi) > 0) return 0; // no sign change, give up rather than mislead
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
  }
  return ((lo + hi) / 2) * 100;
}

function maxDrawdown(values: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (v - peak) / peak;
      if (dd < maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

export function runBacktest(bars: Bar[], config: BacktestConfig): BacktestResult {
  const s = computeSeries(bars, config);
  const n = s.n;

  let cash = config.initialCapital;
  let btc = 0;
  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  let exposureSum = 0;

  // Warm-up split: earlier bars feed the indicators but are not traded and do
  // not enter the equity curve or the benchmark.
  let startIdx = 0;
  if (config.startTime != null) {
    const found = s.time.findIndex((t) => t >= (config.startTime as number));
    startIdx = found >= 0 ? found : n;
  }
  const cap = (frac: number) => Math.min(config.maxLumpFraction, Math.max(0, frac));

  const fee = config.feeRate ?? 0;
  const slip = config.slippageRate ?? 0;
  const nextOpen = config.fillNextOpen ?? false;
  let totalCosts = 0;

  /** A signal on bar i executes on bar i+1's open when fillNextOpen is set,
   * a close-derived signal cannot be filled at that same close. Falls back to
   * the signal bar's close on the final bar. */
  const fillPrice = (i: number, side: "buy" | "sell") => {
    const raw = nextOpen && i + 1 < n ? bars[i + 1].open : s.close[i];
    return side === "buy" ? raw * (1 + slip) : raw * (1 - slip);
  };

  // Buy-and-hold receives the identical cashflows AND the identical frictions.
  // Charging the strategy for execution while the benchmark trades free would
  // bias every comparison against the strategy.
  const bhEntry = startIdx < n ? fillPrice(startIdx, "buy") : 0;
  let bhBtc = bhEntry > 0 ? (config.initialCapital / bhEntry) * (1 - fee) : 0;

  const buy = (i: number, fraction: number, kind: Trade["kind"], reason: string) => {
    const spend = Math.min(cash, cash * Math.min(1, Math.max(0, fraction)));
    const price = fillPrice(i, "buy");
    if (spend <= 0 || price <= 0) return;
    const got = (spend / price) * (1 - fee);
    // Cost = the gap between a frictionless fill and what was actually received.
    totalCosts += spend - got * s.close[i];
    btc += got;
    cash -= spend;
    trades.push({ time: s.time[i], side: "buy", kind, price, usd: spend, btc: got, reason });
  };
  const sell = (i: number, sellBtc: number, kind: Trade["kind"], reason: string) => {
    const price = fillPrice(i, "sell");
    const amt = Math.min(btc, sellBtc);
    if (amt <= 0 || price <= 0) return;
    const proceeds = amt * price * (1 - fee);
    totalCosts += amt * s.close[i] - proceeds;
    btc -= amt;
    cash += proceeds;
    trades.push({ time: s.time[i], side: "sell", kind, price, usd: proceeds, btc: amt, reason });
  };

  // Cashflows for IRR: the opening lump plus every contribution.
  const flows: { t: number; amount: number }[] = [];
  let totalInvested = config.initialCapital;
  if (startIdx < n) flows.push({ t: s.time[startIdx], amount: config.initialCapital });
  const contrib = config.contributionAmount ?? 0;
  const contribEvery = Math.max(1, config.contributionCadenceDays ?? 30);

  for (let i = startIdx; i < n; i++) {
    const price = s.close[i];
    const f = s.fng[i];
    const boost = s.accumBoost[i];

    // Fresh capital arrives before the day's decisions.
    if (contrib > 0 && i > startIdx && (i - startIdx) % contribEvery === 0) {
      cash += contrib;
      totalInvested += contrib;
      flows.push({ t: s.time[i], amount: contrib });
      // Benchmark gets the same cash on the same bar, at the same fill and fee.
      const bhPrice = fillPrice(i, "buy");
      if (bhPrice > 0) bhBtc += (contrib / bhPrice) * (1 - fee);
    }

    // --- Entries ---
    if (config.useDivLump && s.bullDiv[i]) {
      buy(i, cap(config.divLumpFraction * boost), "divLump", "Bullish sentiment divergence");
    }
    if (config.useWashout && s.washout[i]) {
      buy(i, cap(config.washoutLumpFraction * boost), "washoutLump", "Single-day decline in fear");
    }
    if (s.isDcaDay[i]) {
      buy(i, config.dcaBaseFraction * (s.fearMult[i] || 1) * boost, "dcaBuy", "Scheduled interval");
    }

    // --- Exit (confirmed bearish-divergence trim), gated by mode ---
    // s.divTrim[i] is already indexed at the confirmation bar, so this fills at
    // the confirmed price (no look-ahead). Sizing uses the greed at the top.
    if (config.allocationMode !== "accumulate" && s.divTrim[i]) {
      const total = cash + btc * price;
      let sellBtc = btc * Math.min(1, config.trimBaseFraction * s.divTrimGreed[i]);
      if (config.allocationMode === "coreTactical" && total > 0 && price > 0) {
        const coreBtc = (config.coreFraction * total) / price;
        sellBtc = Math.min(sellBtc, Math.max(0, btc - coreBtc));
      }
      sell(i, sellBtc, "divTrim", `Bearish sentiment divergence at greed ${s.divTrimFng[i] ?? f}`);
    }

    const eq = cash + btc * price;
    const exposure = eq > 0 ? (btc * price) / eq : 0;
    exposureSum += exposure;
    equity.push({ time: s.time[i], equity: eq, buyHold: bhBtc * price, exposure });
  }

  const finalEquity = equity.length ? equity[equity.length - 1].equity : config.initialCapital;
  const bhFinal = equity.length ? equity[equity.length - 1].buyHold : config.initialCapital;
  const startT = startIdx < n ? s.time[startIdx] : 0;
  const endT = n ? s.time[n - 1] : 0;
  const years = (endT - startT) / (365.25 * DAY);
  const maxDd = maxDrawdown(equity.map((e) => e.equity)) * 100;
  const irrPct = irr(flows, finalEquity, endT);
  // CAGR assumes a single sum invested for the whole period, so it is wrong the
  // moment cash is added over time: it would divide an equity built from every
  // contribution by the opening balance alone. IRR is the money-weighted
  // equivalent and is what MAR must be built from too, or MAR inherits the same
  // inflation. With no contributions the two are identical to 14 decimal places,
  // so this changes nothing for the default case.
  const contributing = (config.contributionAmount ?? 0) > 0;
  const cagr = contributing
    ? irrPct
    : years > 0 && config.initialCapital > 0
      ? (Math.pow(finalEquity / config.initialCapital, 1 / years) - 1) * 100
      : 0;
  const tradedBars = Math.max(1, n - startIdx);

  return {
    trades,
    equity,
    stats: {
      initialCapital: config.initialCapital,
      totalInvested,
      multipleOnInvested: totalInvested > 0 ? finalEquity / totalInvested : 0,
      irrPct,
      finalEquity,
      // BOTH measured against every dollar actually put in. The buy & hold
      // benchmark receives the same contributions as the strategy (see the
      // `bhBtc += contrib / bhPrice` line above), so dividing it by the opening
      // balance alone reported a portfolio built from every contribution as if
      // it had grown from the first deposit, reading 24,080% where BTC itself
      // moved ~14x. Comparator and strategy must be measured the same way.
      totalReturnPct: (finalEquity / totalInvested - 1) * 100,
      buyHoldReturnPct: (bhFinal / totalInvested - 1) * 100,
      maxDrawdownPct: maxDd,
      buyHoldMaxDrawdownPct: maxDrawdown(equity.map((e) => e.buyHold)) * 100,
      cagrPct: cagr,
      mar: maxDd !== 0 ? cagr / Math.abs(maxDd) : 0,
      numTrades: trades.length,
      totalCosts,
      endBtc: btc,
      endCash: cash,
      avgExposure: exposureSum / tradedBars,
      startDate: toDate(startT),
      endDate: toDate(endT),
    },
  };
}
