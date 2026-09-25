import { ImageResponse } from "next/og";
import { getLivePerformanceTrade } from "@/lib/performance/data";
import { getHistoricalCandles } from "@/lib/performance/market";
import { TradeOpenGraphCard } from "@/lib/performance/og";
import { tradeLegacyImageKey } from "@/lib/performance/social-image-keys";
import {
  ensureTradeSocialImage,
  loadStoredSocialImage,
  loadStoredSocialImageByLegacyKey,
  storedSocialImageResponse,
} from "@/lib/performance/social-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const id = (await params).id;
  const result = await getLivePerformanceTrade(id);
  if (result.status === "unavailable") {
    return new Response("Performance journal unavailable", { status: 503 });
  }
  if (result.status === "not-found") {
    return new Response("Trade not found", { status: 404 });
  }
  const trade = result.trade;

  try {
    const legacyImage = await loadStoredSocialImageByLegacyKey(tradeLegacyImageKey(id));
    if (legacyImage) return storedSocialImageResponse(legacyImage);
  } catch (error) {
    console.error(`[performance/trade-og] failed to load stored image for ${id}`, error);
  }

  try {
    const reference = await ensureTradeSocialImage(trade);
    const image = await loadStoredSocialImage(reference.publicKey);
    if (image) return storedSocialImageResponse(image);
  } catch (error) {
    console.error(`[performance/trade-og] failed to persist image for ${id}`, error);
  }

  const market = await getHistoricalCandles(trade, "1h");
  return new ImageResponse(
    <TradeOpenGraphCard
      trade={trade}
      candles={market?.candles ?? []}
      source={market?.source ?? null}
    />,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
