import "server-only";
import type { PerformanceTrade, TradeCandle } from "./types";

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

/** Fetches the completed trade window from Binance's public hourly feed. */
export async function getHistoricalCandles(
  trade: PerformanceTrade
): Promise<TradeCandle[]> {
  const padding = 12 * 3_600_000;
  const query = new URLSearchParams({
    symbol: trade.symbol,
    interval: "1h",
    limit: "200",
    startTime: String(Date.parse(trade.openedAt) - padding),
    endTime: String(Date.parse(trade.closedAt) + padding),
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

  console.error("[performance/market]", trade.id, lastError);
  return [];
}
