import Link from "next/link";
import { notFound } from "next/navigation";
import { FaArrowLeftLong } from "react-icons/fa6";
import TradeDetailView from "@/Components/performance/TradeDetailView";
import PerformanceUnavailable from "@/Components/performance/PerformanceUnavailable";
import { getLivePerformanceTrade } from "@/lib/performance/data";
import { getHistoricalCandles } from "@/lib/performance/market";
import { signedR } from "@/lib/performance/metrics";
import { tradeOpenGraphAlt } from "@/lib/performance/og";
import { socialImagePath } from "@/lib/performance/social-image-keys";
import { ensureTradeSocialImage } from "@/lib/performance/social-images";
import { siteOrigin } from "@/lib/site-origin";

type Props = { params: Promise<{ id: string }> };

const metadataDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export async function generateMetadata({ params }: Props) {
  const id = (await params).id;
  const result = await getLivePerformanceTrade(id);
  if (result.status !== "available") return { title: "Trade unavailable, The Blueprint" };
  const item = result.trade;
  const displaySymbol = item.symbol.replace("USDT", " / USDT");
  const title = `${displaySymbol} ${item.direction}: ${signedR(item.resultR)} | Performance Journal`;
  const description = `Review a completed ${displaySymbol} ${item.direction.toLowerCase()} from ${metadataDate.format(new Date(item.openedAt))} to ${metadataDate.format(new Date(item.closedAt))}, with its entry-to-exit price chart and recorded ${signedR(item.resultR)} result.`;
  const canonical = `https://mentor.thomas-johnston.com/performance/trades/${encodeURIComponent(id)}`;
  let image = `${siteOrigin()}/api/performance/trades/${encodeURIComponent(id)}/og`;
  try {
    const stored = await ensureTradeSocialImage(item);
    image = `${siteOrigin()}${socialImagePath(stored.publicKey)}`;
  } catch (error) {
    console.error(`[performance/metadata] failed to prepare image for ${id}`, error);
  }
  const images = [{ url: image, width: 1200, height: 630, alt: tradeOpenGraphAlt(item) }];
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "article" as const, url: canonical, title, description, images },
    twitter: { card: "summary_large_image" as const, title, description, images },
  };
}

export default async function TradePage({ params }: Props) {
  const result = await getLivePerformanceTrade((await params).id);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") {
    return (
      <main className="min-h-[calc(100vh-4rem)] pb-24">
        <div className="mx-auto max-w-7xl px-4 pt-7 sm:px-6 sm:pt-10">
          <Link href="/performance" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white">
            <FaArrowLeftLong className="text-xs" /> Performance journal
          </Link>
          <div className="mt-7"><PerformanceUnavailable title="This trade is temporarily unavailable." /></div>
        </div>
      </main>
    );
  }
  const trade = result.trade;
  const market = await getHistoricalCandles(trade, "4h", 24);
  return <TradeDetailView trade={trade} market={market} />;
}
