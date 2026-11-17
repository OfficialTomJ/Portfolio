import { NextResponse } from "next/server";
import { portfolioPublicEnabled } from "@/lib/btc-portfolio/mode";
import { loadDatabasePortfolio } from "@/lib/btc-portfolio/public-repository";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (!portfolioPublicEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  try {
    const data = await loadDatabasePortfolio();
    return NextResponse.json(data, { headers: { ...headers, "X-Portfolio-Checked-At": new Date().toISOString() } });
  }
  catch { return NextResponse.json({ error: "Portfolio unavailable" }, { status: 503, headers }); }
}
