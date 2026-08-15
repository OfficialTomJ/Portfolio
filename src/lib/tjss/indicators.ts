// Hand-rolled technical indicators (no external deps, matching the repo's
// lean dependency style). Every function returns an array aligned index-for-
// index with the input; warm-up positions are `null`.

export type Series = (number | null)[];

/** Simple moving average. */
export function sma(values: number[], length: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (length <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out[i] = sum / length;
  }
  return out;
}

/** Exponential moving average, seeded with the SMA of the first `length` values. */
export function ema(values: number[], length: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (length <= 0 || values.length < length) return out;
  const k = 2 / (length + 1);
  let seed = 0;
  for (let i = 0; i < length; i++) seed += values[i];
  let prev = seed / length;
  out[length - 1] = prev;
  for (let i = length; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(values: number[], length: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= length) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= length; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / length;
  let avgLoss = loss / length;
  out[length] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = length + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (length - 1) + g) / length;
    avgLoss = (avgLoss * (length - 1) + l) / length;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: Series;
  signal: Series;
  hist: Series;
}

/** MACD (fast/slow/signal EMAs). */
export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalLen = 9
): MacdResult {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: Series = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null
      ? (emaFast[i] as number) - (emaSlow[i] as number)
      : null
  );

  // Signal = EMA of the defined portion of the MACD line.
  const defined: number[] = [];
  const firstIdx = macdLine.findIndex((v) => v != null);
  if (firstIdx === -1) {
    return { macd: macdLine, signal: macdLine.slice(), hist: macdLine.slice() };
  }
  for (let i = firstIdx; i < macdLine.length; i++) {
    defined.push(macdLine[i] as number);
  }
  const sigDefined = ema(defined, signalLen);
  const signal: Series = new Array(values.length).fill(null);
  for (let i = 0; i < sigDefined.length; i++) {
    signal[firstIdx + i] = sigDefined[i];
  }
  const hist: Series = values.map((_, i) =>
    macdLine[i] != null && signal[i] != null
      ? (macdLine[i] as number) - (signal[i] as number)
      : null
  );
  return { macd: macdLine, signal, hist };
}

/** Pivot low: value at `i` is the strict minimum of the window
 * [i-left, i+right]. Non-pivot positions are null. */
export function pivotLow(values: number[], left: number, right: number): Series {
  const out: Series = new Array(values.length).fill(null);
  for (let i = left; i < values.length - right; i++) {
    const v = values[i];
    let isPivot = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j !== i && values[j] <= v) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) out[i] = v;
  }
  return out;
}

/** Pivot high: value at `i` is the strict maximum of [i-left, i+right]. */
export function pivotHigh(values: number[], left: number, right: number): Series {
  const out: Series = new Array(values.length).fill(null);
  for (let i = left; i < values.length - right; i++) {
    const v = values[i];
    let isPivot = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j !== i && values[j] >= v) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) out[i] = v;
  }
  return out;
}

/**
 * Regular divergence flags computed at confirmed price pivots.
 *
 * Bullish: price prints a lower pivot-low while the oscillator prints a higher
 * pivot-low (hidden strength under falling price). Bearish is the mirror at
 * pivot-highs. The flag is set on the pivot bar; the caller decides how long
 * to treat it as "still active".
 */
export function divergences(
  price: number[],
  osc: Series,
  left: number,
  right: number
): { bullish: boolean[]; bearish: boolean[] } {
  const bullish = new Array(price.length).fill(false);
  const bearish = new Array(price.length).fill(false);
  const lows = pivotLow(price, left, right);
  const highs = pivotHigh(price, left, right);

  let prevLowIdx = -1;
  for (let i = 0; i < price.length; i++) {
    if (lows[i] == null) continue;
    if (prevLowIdx !== -1) {
      const oNow = osc[i];
      const oPrev = osc[prevLowIdx];
      if (
        oNow != null &&
        oPrev != null &&
        price[i] < price[prevLowIdx] &&
        oNow > oPrev
      ) {
        bullish[i] = true;
      }
    }
    prevLowIdx = i;
  }

  let prevHighIdx = -1;
  for (let i = 0; i < price.length; i++) {
    if (highs[i] == null) continue;
    if (prevHighIdx !== -1) {
      const oNow = osc[i];
      const oPrev = osc[prevHighIdx];
      if (
        oNow != null &&
        oPrev != null &&
        price[i] > price[prevHighIdx] &&
        oNow < oPrev
      ) {
        bearish[i] = true;
      }
    }
    prevHighIdx = i;
  }

  return { bullish, bearish };
}
