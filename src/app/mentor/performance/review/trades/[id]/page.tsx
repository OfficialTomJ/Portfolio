import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrivateTradeReview from "@/Components/performance/PrivateTradeReview";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { getAdminPerformanceSnapshot, getAdminPerformanceTrade } from "@/lib/performance/admin-data";
import { getHistoricalCandles } from "@/lib/performance/market";
import { getTagCatalogue, getTradeAnnotations } from "@/lib/performance/annotations";
import { nextUnreviewedTradeId } from "@/lib/performance/review-workspace";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trade review | Admin",
  robots: { index: false, follow: false },
};

export default async function PrivateTradePage({ params }: Props) {
  if (!await getPerformanceAdminSession()) notFound();
  const { id } = await params;
  let result;
  try {
    result = await getAdminPerformanceTrade(id);
  } catch (error) {
    console.error("[performance/review/trade] failed to load trade", error);
    notFound();
  }
  if (!result) notFound();
  const [market, annotations, tags, snapshot] = await Promise.all([
    getHistoricalCandles(result.trade, "4h", 24),
    getTradeAnnotations([id]),
    getTagCatalogue(),
    getAdminPerformanceSnapshot(),
  ]);
  const nextTradeId = snapshot ? nextUnreviewedTradeId(id, snapshot.dataset.trades, snapshot.annotations) : null;
  const publication = result.status === "published" ? { status: "published" as const, trade: result.trade }
    : { status: "unpublished" as const, trade: result.trade, fingerprint: result.fingerprint! };
  return <PrivateTradeReview trade={result.trade} market={market} status={result.status} annotation={annotations[id]} tags={tags} nextTradeId={nextTradeId} publication={publication} />;
}
