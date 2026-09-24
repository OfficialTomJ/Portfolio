import "server-only";
import type {
  MarketCandles,
  PerformanceTrade,
  TradeCandle,
  TradeCandleInterval,
  TradeCandleSource,
} from "./types";
import { parseBinanceCandles, parseBybitCandles } from "./market-response";

const BINANCE_HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];
const BYBIT_HOST = "https://api.bybit.com";

export const CANDLE_INTERVAL_MS: Record<TradeCandleInterval, number> = {
  "1h": 3_600_000,
  "4h": 4 * 3_600_000,
  "1d": 24 * 3_600_000,
};

const BYBIT_INTERVAL: Record<TradeCandleInterval, string> = {
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

export interface HistoricalCandleQuery {
  symbol: string;
  interval?: TradeCandleInterval;
  limit?: number;
  startTime?: number;
  endTime?: number;
  source?: TradeCandleSource;
}

function limit(value: number | undefined, maximum: number): number {
  return Math.min(maximum, Math.max(1, value ?? 200));
}

export async function getBinanceCandles({
  symbol,
  interval = "1h",
  limit: requestedLimit = 200,
  startTime,
  endTime,
}: HistoricalCandleQuery): Promise<TradeCandle[]> {
  const query = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit(requestedLimit, 500)),
    ...(startTime === undefined ? {} : { startTime: String(startTime) }),
    ...(endTime === undefined ? {} : { endTime: String(endTime) }),
  });

  let lastError: unknown = null;
  for (const host of BINANCE_HOSTS) {
    try {
      const response = await fetch(`${host}/api/v3/klines?${query}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 86_400 },
      });
      if (!response.ok) throw new Error(`${host} responded ${response.status}`);
      return parseBinanceCandles(await response.json());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Binance market data is unavailable");
}

export async function getBybitCandles({
  symbol,
  interval = "1h",
  limit: requestedLimit = 200,
  startTime,
  endTime,
}: HistoricalCandleQuery): Promise<TradeCandle[]> {
  const candleLimit = limit(requestedLimit, 1000);
  // Bybit returns newest first. Bound forward requests so the next page begins
  // after the current candle rather than jumping to the latest candle today.
  const cappedEnd = startTime === undefined
    ? endTime
    : Math.min(endTime ?? Infinity, startTime + candleLimit * CANDLE_INTERVAL_MS[interval] - 1);
  const query = new URLSearchParams({
    category: "linear",
    symbol,
    interval: BYBIT_INTERVAL[interval],
    limit: String(candleLimit),
    ...(startTime === undefined ? {} : { start: String(startTime) }),
    ...(cappedEnd === undefined ? {} : { end: String(cappedEnd) }),
  });
  const response = await fetch(`${BYBIT_HOST}/v5/market/kline?${query}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error(`Bybit market data responded ${response.status}`);
  return parseBybitCandles(await response.json(), symbol);
}

export async function getMarketCandles(query: HistoricalCandleQuery): Promise<MarketCandles> {
  if (query.source === "binance") {
    return { candles: await getBinanceCandles(query), source: "binance" };
  }
  if (query.source === "bybit") {
    return { candles: await getBybitCandles(query), source: "bybit" };
  }

  try {
    const candles = await getBinanceCandles(query);
    if (!candles.length) throw new Error("Binance returned no candles");
    return { candles, source: "binance" };
  } catch (binanceError) {
    try {
      const candles = await getBybitCandles(query);
      if (!candles.length) throw new Error("Bybit returned no candles");
      return { candles, source: "bybit" };
    } catch (bybitError) {
      throw new AggregateError(
        [binanceError, bybitError],
        `No market candles are available for ${query.symbol}`
      );
    }
  }
}

/** Loads the trade window with context on both sides. */
export async function getHistoricalCandles(
  trade: PerformanceTrade,
  interval: TradeCandleInterval = "4h",
  bufferBars = 12
): Promise<MarketCandles | null> {
  const intervalMs = CANDLE_INTERVAL_MS[interval];
  const padding = bufferBars * intervalMs;
  const tradeBars = Math.ceil((Date.parse(trade.closedAt) - Date.parse(trade.openedAt)) / intervalMs);
  try {
    return await getMarketCandles({
      symbol: trade.symbol,
      interval,
      limit: Math.min(500, Math.max(200, tradeBars + bufferBars * 2 + 1)),
      startTime: Date.parse(trade.openedAt) - padding,
      endTime: Date.parse(trade.closedAt) + padding,
    });
  } catch (error) {
    console.error("[performance/market]", trade.id, error);
    return null;
  }
}
