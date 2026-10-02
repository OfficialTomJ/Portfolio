import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { getAdminPerformanceSnapshot } from "@/lib/performance/admin-data";
import { asrStatus, TRADE_ID_PATTERN } from "@/lib/performance/annotations-model";
import { nextUnreviewedTradeId } from "@/lib/performance/review-workspace";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/** A read-only, fresh queue lookup after a confirmed metadata save. */
export async function GET(request: NextRequest) {
  if (!await getPerformanceAdminSession()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const current = request.nextUrl.searchParams.get("current") ?? "";
  if (!TRADE_ID_PATTERN.test(current)) return NextResponse.json({ error: "Invalid trade" }, { status: 400, headers });
  try {
    const snapshot = await getAdminPerformanceSnapshot();
    if (!snapshot?.dataset.trades.some(trade => trade.id === current)) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    if (asrStatus(snapshot.annotations[current]) !== "Reviewed") return NextResponse.json({ error: "Complete the current ASR first" }, { status: 409, headers });
    return NextResponse.json({ id: nextUnreviewedTradeId(current, snapshot.dataset.trades, snapshot.annotations) }, { headers });
  } catch {
    return NextResponse.json({ error: "Could not load the next review" }, { status: 503, headers });
  }
}
