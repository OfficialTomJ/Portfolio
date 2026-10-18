import { ImageResponse } from "next/og";
import { buildPerformanceView } from "@/lib/performance/metrics";
import { PerformanceOpenGraphCard } from "@/lib/performance/og";
import { riskPreviewDataset, riskPreviewEnabled } from "@/lib/performance/risk-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!riskPreviewEnabled()) return new Response(null, { status: 404 });
  const dataset = riskPreviewDataset(new URL(request.url).searchParams.get("scenario") ?? undefined);
  return new ImageResponse(<div style={{ position: "relative", display: "flex", width: 1200, height: 630 }}>
    <PerformanceOpenGraphCard dataset={dataset} view={buildPerformanceView(dataset, "YTD", 2026)} />
    <div style={{ position: "absolute", display: "flex", right: 60, top: 36, fontSize: 15, color: "#fbbf24" }}>SYNTHETIC STAGING PREVIEW</div>
  </div>, {
    width: 1200, height: 630,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" },
  });
}
