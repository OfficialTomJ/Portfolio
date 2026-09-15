import "server-only";
import type { PerformanceTrade, TradeCandle } from "./types";

const PRODUCTS: Record<string, string> = {
  BTCUSDT: "BTC-USD",
  ETHUSDT: "ETH-USD",
  SOLUSDT: "SOL-USD",
};

/** Fetches a fixed historical window from Coinbase's public hourly feed. */
export async function getHistoricalCandles(
  trade: PerformanceTrade
): Promise<TradeCandle[]> {
  const padding = 12 * 3_600_000;
  const product = PRODUCTS[trade.symbol];
  if (!product) return [];
  const query = new URLSearchParams({
    granularity: "3600",
    start: new Date(Date.parse(trade.openedAt) - padding).toISOString(),
    end: new Date(Date.parse(trade.closedAt) + padding).toISOString(),
  });

  try {
    const response = await fetch(
      `https://api.exchange.coinbase.com/products/${product}/candles?${query}`,
      {
        headers: { "User-Agent": "performance-journal/1.0" },
        next: { revalidate: 86_400 },
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as number[][];
    if (!Array.isArray(payload)) throw new Error("Invalid market response");

    return payload
      .map(([time, low, high, open, close]) => ({
        time,
        open,
        high,
        low,
        close,
      }))
      .sort((a, b) => a.time - b.time);
  } catch (error) {
    console.error("[performance/market]", trade.id, error);
    return [];
  }
}
