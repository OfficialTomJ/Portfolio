import { NextRequest, NextResponse } from "next/server";
import { CANDLE_INTERVAL_MS, getMarketCandles } from "@/lib/performance/market";
import type { TradeCandleInterval, TradeCandleSource } from "@/lib/performance/types";

export const runtime = "nodejs";

const SYMBOL_PATTERN = /^[A-Z0-9]{2,15}USDT$/;
const INTERVALS = new Set<TradeCandleInterval>(["1h", "4h", "1d"]);
const SOURCES = new Set<TradeCandleSource>(["binance", "bybit"]);

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") ?? "").toUpperCase();
  const direction = request.nextUrl.searchParams.get("direction");
  const boundary = Number(request.nextUrl.searchParams.get("time"));
  const intervalValue = request.nextUrl.searchParams.get("interval") ?? "4h";
  const interval = INTERVALS.has(intervalValue as TradeCandleInterval)
    ? intervalValue as TradeCandleInterval
    : null;
  const sourceValue = request.nextUrl.searchParams.get("source");
  const source = sourceValue && SOURCES.has(sourceValue as TradeCandleSource)
    ? sourceValue as TradeCandleSource
    : null;

  if (
    !SYMBOL_PATTERN.test(symbol) || !interval ||
    (sourceValue !== null && !source) ||
    !["before", "after", "window"].includes(direction ?? "")
  ) {
    return NextResponse.json({ error: "Invalid market data request" }, { status: 400 });
  }
  if (direction !== "window" && (!Number.isSafeInteger(boundary) || boundary <= 0)) {
    return NextResponse.json({ error: "Invalid market data boundary" }, { status: 400 });
  }

  try {
    const boundaryMs = boundary * 1000;
    const start = Number(request.nextUrl.searchParams.get("start"));
    const end = Number(request.nextUrl.searchParams.get("end"));
    if (direction === "window" && (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start <= 0 ||
      end <= start ||
      end - start > 2 * 365 * 24 * 3_600
    )) {
      return NextResponse.json({ error: "Invalid market data window" }, { status: 400 });
    }
    const market = await getMarketCandles({
      symbol,
      interval,
      ...(source ? { source } : {}),
      limit: direction === "window" ? 500 : 200,
      ...(direction === "window"
        ? { startTime: start * 1000, endTime: end * 1000 }
        : direction === "before"
        ? { endTime: boundaryMs - 1 }
        : { startTime: boundaryMs + CANDLE_INTERVAL_MS[interval] }),
    });
    return NextResponse.json(
      market,
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch (error) {
    console.error("[performance/market-history]", error);
    return NextResponse.json({ error: "Market history is temporarily unavailable" }, { status: 502 });
  }
}
