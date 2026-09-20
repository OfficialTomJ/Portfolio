import "server-only";
import type { PerformanceTrade, TradeCandle, TradeCandleInterval } from "./types";

// Match the TJSS dashboard: Binance first, then its public data mirror.
const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  ...unknown[]
];

export interface HistoricalCandleQuery {
  symbol: string;
  interval?: TradeCandleInterval;
  limit?: number;
  startTime?: number;
  endTime?: number;
}

export async function getBinanceCandles({
  symbol,
  interval = "1h",
  limit = 200,
  startTime,
  endTime,
}: HistoricalCandleQuery): Promise<TradeCandle[]> {
  const query = new URLSearchParams({
    symbol,
    interval,
    limit: String(Math.min(500, Math.max(1, limit))),
    ...(startTime === undefined ? {} : { startTime: String(startTime) }),
    ...(endTime === undefined ? {} : { endTime: String(endTime) }),
  });

  let lastError: unknown = null;
  for (const host of HOSTS) {
    try {
      const response = await fetch(`${host}/api/v3/klines?${query}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 86_400 },
      });
      if (!response.ok) throw new Error(`${host} responded ${response.status}`);
      const payload = (await response.json()) as BinanceKline[];
      if (!Array.isArray(payload)) throw new Error("Invalid Binance response");

      return payload.map((kline) => ({
        time: Math.floor(kline[0] / 1000),
        open: Number(kline[1]),
        high: Number(kline[2]),
        low: Number(kline[3]),
        close: Number(kline[4]),
      }));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Binance market data is unavailable");
}

const INTERVAL_MS: Record<TradeCandleInterval, number> = {
  "1h": 3_600_000,
  "4h": 4 * 3_600_000,
  "1d": 24 * 3_600_000,
};

/** Fetches the completed trade window from Binance with a configurable candle buffer on either side. */
export async function getHistoricalCandles(
  trade: PerformanceTrade,
  interval: TradeCandleInterval = "4h",
  bufferBars = 12
): Promise<TradeCandle[]> {
  const intervalMs = INTERVAL_MS[interval];
  const padding = bufferBars * intervalMs;
  const tradeBars = Math.ceil((Date.parse(trade.closedAt) - Date.parse(trade.openedAt)) / intervalMs);
  try {
    return await getBinanceCandles({
      symbol: trade.symbol,
      interval,
      limit: Math.min(500, Math.max(200, tradeBars + bufferBars * 2 + 1)),
      startTime: Date.parse(trade.openedAt) - padding,
      endTime: Date.parse(trade.closedAt) + padding,
    });
  } catch (error) {
    console.error("[performance/market]", trade.id, error);
    return [];
  }
}
