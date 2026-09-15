import "server-only";
import type { PerformanceTrade, TradeCandle } from "./types";

type BybitKlineResponse = {
  retCode: number;
  retMsg: string;
  result?: { list?: string[][] };
};

/** Fetches a fixed historical window from Bybit's public hourly candle feed. */
export async function getHistoricalCandles(
  trade: PerformanceTrade
): Promise<TradeCandle[]> {
  const padding = 12 * 3_600_000;
  const query = new URLSearchParams({
    category: "linear",
    symbol: trade.symbol,
    interval: "60",
    start: String(Date.parse(trade.openedAt) - padding),
    end: String(Date.parse(trade.closedAt) + padding),
    limit: "200",
  });

  try {
    const response = await fetch(`https://api.bybit.com/v5/market/kline?${query}`, {
      next: { revalidate: 86_400 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as BybitKlineResponse;
    if (payload.retCode !== 0 || !payload.result?.list) {
      throw new Error(payload.retMsg || "Invalid Bybit response");
    }

    return payload.result.list
      .map(([time, open, high, low, close]) => ({
        time: Math.floor(Number(time) / 1000),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
      }))
      .sort((a, b) => a.time - b.time);
  } catch (error) {
    console.error("[performance/market]", trade.id, error);
    return [];
  }
}
