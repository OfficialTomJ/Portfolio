import { ImageResponse } from "next/og";
import { getLivePerformanceDataset } from "@/lib/performance/data";
import { buildPerformanceView, sydneyYear } from "@/lib/performance/metrics";
import { PerformanceOpenGraphCard } from "@/lib/performance/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const result = await getLivePerformanceDataset();
  if (result.status !== "available") {
    return new Response("Performance journal unavailable", { status: 503 });
  }

  const dataset = result.dataset;
  const view = buildPerformanceView(dataset, "YTD", sydneyYear(dataset.asOf));
  return new ImageResponse(<PerformanceOpenGraphCard dataset={dataset} view={view} />, {
    width: 1200,
    height: 630,
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
