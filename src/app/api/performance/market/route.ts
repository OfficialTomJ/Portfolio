import { NextRequest, NextResponse } from "next/server";
import { getBinanceCandles } from "@/lib/performance/market";

export const runtime = "nodejs";

const SYMBOL_PATTERN = /^[A-Z0-9]{2,15}USDT$/;

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") ?? "").toUpperCase();
  const direction = request.nextUrl.searchParams.get("direction");
  const boundary = Number(request.nextUrl.searchParams.get("time"));

  if (!SYMBOL_PATTERN.test(symbol) || !["before", "after"].includes(direction ?? "")) {
    return NextResponse.json({ error: "Invalid market data request" }, { status: 400 });
  }
  if (!Number.isSafeInteger(boundary) || boundary <= 0) {
    return NextResponse.json({ error: "Invalid market data boundary" }, { status: 400 });
  }

  try {
    const boundaryMs = boundary * 1000;
    const candles = await getBinanceCandles({
      symbol,
      limit: 200,
      ...(direction === "before"
        ? { endTime: boundaryMs - 1 }
        : { startTime: boundaryMs + 1 }),
    });
    return NextResponse.json(
      { candles },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch (error) {
    console.error("[performance/market-history]", error);
    return NextResponse.json({ error: "Market history is temporarily unavailable" }, { status: 502 });
  }
}
