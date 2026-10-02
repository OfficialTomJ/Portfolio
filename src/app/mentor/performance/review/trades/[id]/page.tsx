import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TradeDetailView from "@/Components/performance/TradeDetailView";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { getAdminPerformanceTrade } from "@/lib/performance/admin-data";
import { getHistoricalCandles } from "@/lib/performance/market";
import { getTagCatalogue, getTradeAnnotations } from "@/lib/performance/annotations";

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
  const [market, annotations, tags] = await Promise.all([
    getHistoricalCandles(result.trade, "4h", 24),
    getTradeAnnotations([id]),
    getTagCatalogue(),
  ]);
  return <TradeDetailView trade={result.trade} market={market} reviewStatus={result.status} annotation={annotations[id]} tagCatalogue={tags} />;
}
