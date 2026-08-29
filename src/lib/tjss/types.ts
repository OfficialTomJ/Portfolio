// Shared types for the TJSS Method engine (signals + backtest).
// Pure data types only, no server/client dependencies.
//
// These are SHAPES, not values. This repo is public, so no default, threshold
// or backtest result belongs in it: every tuned parameter lives in the
// `tjss_presets` collection in Mongo and is loaded per request by presets.ts.
//
// The engine's mechanism is public; its calibration is not.

export type Classification =
  | "Extreme Fear"
  | "Fear"
  | "Neutral"
  | "Greed"
  | "Extreme Greed";

/** Daily OHLCV candle. `time` is a UTC-day unix timestamp in SECONDS. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FngPoint {
  time: number;
  value: number;
  classification: Classification;
}

export interface Bar extends Candle {
  fng: number | null;
}

export type AllocationMode = "roundTrip" | "coreTactical" | "accumulate";
export type Regime = "bull" | "bear";

/** Signal-engine parameters. Values come from `tjss_presets` in Mongo. */
export interface TjssConfig {
  allocationMode: AllocationMode;

  // Sentiment reference levels (labels only).
  fearThreshold: number;
  greedThreshold: number;

  // Regime filter
  regimeLength: number;
  useRegime: boolean;
  bearAccumBoost: number;

  // Scheduled entries
  dcaCadenceDays: number;
  dcaFearCap: number;
  fearWeightMax: number;

  // Optional washout / capitulation lumps
  useWashout: boolean;
  washoutDayPct: number;
  washoutFngMax: number;
  volLength: number;
  volMultiplier: number;
  useVolume: boolean;

  // Optional bullish-divergence lumps
  useDivLump: boolean;
  divPivotLeft: number;
  divPivotRight: number;

  // Bearish-divergence trims
  trimGreedFloor: number;
  greedWeightMax: number;
  trimConfirm: boolean;
  trimConfirmLength: number;

  // Multi-timeframe trend layer
  useTrend: boolean;
  trendEmaLength: number;
  trendConfirmWeeks: number;
  trendRegime: boolean;
  trendArmTrims: boolean;
  deepValueMult: number;
  deepValueBoost: number;
  deepValueTranche: boolean;
  deepValueFloor: number;
}

export type SignalType = "dcaBuy" | "washoutLump" | "divLump" | "divTrim";

export interface SignalMarker {
  time: number;
  type: SignalType;
  fng: number | null;
  price: number;
  /** Fraction the model allocated (adds) or reduced (exits) at this trigger. */
  size: number;
  reason: string;
}

export interface BarState {
  time: number;
  fng: number | null;
  classification: Classification | null;
  regime: Regime;
  regimeEma: number | null;
  signals: SignalType[];
  weeklyBull?: boolean; // weekly close above the W50 (confirmed)
  dailyBull?: boolean; // close above the daily 50 EMA
  deepValue?: boolean; // inside the M50 "bottom area"
}

export interface CurrentState {
  time: number;
  price: number;
  fng: number | null;
  classification: Classification | null;
  regime: Regime;
  targetExposure: number;
  action: string;
  detail: string;
  lastSignal: SignalMarker | null;
  trend?: {
    weeklyBull: boolean;
    dailyBull: boolean;
    deepValue: boolean;
    d50: number | null;
    w50: number | null;
    m50: number | null;
  };
}

export interface SignalResult {
  bars: BarState[];
  markers: SignalMarker[];
  current: CurrentState;
}

// ---- Backtest ----

export interface BacktestConfig extends TjssConfig {
  /** Bars before this unix-day are used for indicator WARM-UP only (no trades,
   * no equity, excluded from the buy-and-hold benchmark). Needed because the
   * 50-month EMA wants years of history before the tradable window. */
  startTime?: number;
  initialCapital: number;
  /** Periodic cash added to the account (0 = the original lump-only model).
   * Contributing over time is what members actually do and it structurally
   * reduces how much the start date matters. */
  contributionAmount?: number;
  contributionCadenceDays?: number;
  /** Exchange fee per side (0.001 = 0.1%). */
  feeRate?: number;
  /** Adverse price move on execution (0.0005 = 0.05%). */
  slippageRate?: number;
  /**
   * Fill on the NEXT bar's open instead of the signal bar's close. A signal
   * derived from a bar's close cannot be executed at that same close, so
   * leaving this off overstates results.
   */
  fillNextOpen?: boolean;
  dcaBaseFraction: number; // base fraction of remaining cash per DCA buy
  washoutLumpFraction: number;
  divLumpFraction: number;
  trimBaseFraction: number; // base fraction of BTC sold per trim
  coreFraction: number; // coreTactical floor
  maxLumpFraction: number; // cap on any single lump (so lumps ladder in)
}

export interface Trade {
  time: number;
  side: "buy" | "sell";
  kind: SignalType;
  price: number;
  usd: number;
  btc: number;
  reason: string;
}

/** Cash paid into the account: the opening lump, then each contribution. */
export interface Cashflow {
  time: number;
  amount: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  buyHold: number;
  exposure: number;
}

export interface BacktestStats {
  initialCapital: number;
  /** initialCapital + every contribution actually paid in. */
  totalInvested: number;
  /** finalEquity / totalInvested. */
  multipleOnInvested: number;
  /** Money-weighted annual return. CAGR is meaningless once cash is added
   * over time; this is the number to read when contributions are on. */
  irrPct: number;
  finalEquity: number;
  totalReturnPct: number;
  buyHoldReturnPct: number;
  maxDrawdownPct: number;
  buyHoldMaxDrawdownPct: number;
  cagrPct: number;
  /** The benchmark annualised the same way as `cagrPct`: money-weighted when
   * contributions are on, since buy & hold receives the same cashflows. */
  buyHoldCagrPct: number;
  mar: number; // CAGR / |maxDrawdown|, return per unit of risk
  numTrades: number;
  /** Total fees + slippage paid, in currency. */
  totalCosts: number;
  endBtc: number;
  endCash: number;
  avgExposure: number;
  startDate: string;
  endDate: string;
}

export interface BacktestResult {
  trades: Trade[];
  equity: EquityPoint[];
  /** Deposits, in order. Both the strategy and the benchmark curve receive
   * these, so both must have them subtracted before returns are measured. */
  cashflows: Cashflow[];
  stats: BacktestStats;
}

export function classify(value: number): Classification {
  if (value <= 24) return "Extreme Fear";
  if (value <= 49) return "Fear";
  if (value === 50) return "Neutral";
  if (value <= 74) return "Greed";
  return "Extreme Greed";
}

/** DCA multiplier from fear depth: 1 at neutral (50), ramping to
 * `fearWeightMax` at F&G 0, 0 above the DCA fear cap. */
export function fearMultiplier(
  fng: number,
  fearWeightMax: number,
  dcaFearCap: number
): number {
  if (fng > dcaFearCap) return 0;
  if (fng >= 50 || fearWeightMax <= 1) return fng > dcaFearCap ? 0 : 1;
  const t = (50 - fng) / 50;
  return 1 + t * (fearWeightMax - 1);
}

/** Trim multiplier from greed: 0 below the floor, ramping to `greedWeightMax`
 * as F&G approaches 100. */
export function greedMultiplier(
  fng: number,
  trimGreedFloor: number,
  greedWeightMax: number
): number {
  if (fng < trimGreedFloor) return 0;
  const span = 100 - trimGreedFloor;
  const t = span > 0 ? (fng - trimGreedFloor) / span : 1;
  return 1 + t * (greedWeightMax - 1);
}
