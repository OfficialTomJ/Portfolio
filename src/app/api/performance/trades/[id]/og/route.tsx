import { ImageResponse } from "next/og";
import { getLivePerformanceTrade } from "@/lib/performance/data";
import { getHistoricalCandles } from "@/lib/performance/market";
import { TradeOpenGraphCard } from "@/lib/performance/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const trade = await getLivePerformanceTrade((await params).id);
  if (!trade) return new Response("Trade not found", { status: 404 });

  const candles = await getHistoricalCandles(trade, "1h");
  return new ImageResponse(<TradeOpenGraphCard trade={trade} candles={candles} />, {
    width: 1200,
    height: 630,
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
