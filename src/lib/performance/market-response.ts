import type { TradeCandle } from "./types";

function parseCandle(row: unknown): TradeCandle {
  if (!Array.isArray(row) || row.length < 5) throw new Error("Invalid market candle");
  const [rawTime, rawOpen, rawHigh, rawLow, rawClose] = row;
  const timestamp = Number(rawTime);
  const open = Number(rawOpen);
  const high = Number(rawHigh);
  const low = Number(rawLow);
  const close = Number(rawClose);
  if (
    !Number.isSafeInteger(timestamp) || timestamp <= 0 ||
    ![open, high, low, close].every((price) => Number.isFinite(price) && price > 0) ||
    high < Math.max(open, close, low) || low > Math.min(open, close)
  ) {
    throw new Error("Invalid market candle values");
  }
  return { time: Math.floor(timestamp / 1000), open, high, low, close };
}

function normalizeRows(rows: unknown): TradeCandle[] {
  if (!Array.isArray(rows)) throw new Error("Invalid market candle list");
  const candles = rows.map(parseCandle).sort((a, b) => a.time - b.time);
  if (candles.some((candle, index) => index > 0 && candle.time === candles[index - 1].time)) {
    throw new Error("Market returned duplicate candle times");
  }
  return candles;
}

export function parseBinanceCandles(payload: unknown): TradeCandle[] {
  return normalizeRows(payload);
}

export function parseBybitCandles(payload: unknown, symbol: string): TradeCandle[] {
  if (!payload || typeof payload !== "object") throw new Error("Invalid Bybit response");
  const body = payload as {
    retCode?: unknown;
    result?: { category?: unknown; symbol?: unknown; list?: unknown };
  };
  if (
    body.retCode !== 0 || body.result?.category !== "linear" ||
    body.result.symbol !== symbol
  ) {
    throw new Error("Bybit did not return the requested linear market");
  }
  return normalizeRows(body.result.list);
}

/** A chart source must contain every candle while the trade was open. */
export function coversTradePeriod(
  candles: TradeCandle[],
  openedAtMs: number,
  closedAtMs: number,
  intervalMs: number
): boolean {
  if (!candles.length || openedAtMs > closedAtMs || intervalMs <= 0) return false;
  const openedAt = Math.floor(openedAtMs / 1000);
  const closedAt = Math.floor(closedAtMs / 1000);
  const interval = intervalMs / 1000;
  const active = candles.filter((candle) =>
    candle.time <= closedAt && candle.time + interval > openedAt
  );
  if (!active.length || active[0].time > openedAt ||
      active[active.length - 1].time + interval <= closedAt) return false;
  return active.every((candle, index) =>
    index === 0 || candle.time - active[index - 1].time === interval
  );
}
