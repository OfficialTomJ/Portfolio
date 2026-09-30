import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { PerformanceSyncAlreadyRunningError, syncPerformanceJournal } from "@/lib/performance/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
}

export async function POST(request: NextRequest) {
  if (!await getPerformanceAdminSession()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    const result = await syncPerformanceJournal();
    return NextResponse.json(
      { ok: true, positionsCaptured: result.positionsCaptured, tradesPublished: result.tradesPublished },
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    if (error instanceof PerformanceSyncAlreadyRunningError) {
      return NextResponse.json({ ok: false, status: "already_running" }, { status: 409, headers: PRIVATE_HEADERS });
    }
    console.error("[performance/admin/sync]", error);
    return NextResponse.json({ ok: false, error: "Sync failed" }, { status: 502, headers: PRIVATE_HEADERS });
  }
}
