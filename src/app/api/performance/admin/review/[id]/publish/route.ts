import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import {
  approvePerformanceReviewCandidate,
  isPerformanceReviewPublished,
  PerformanceReviewCandidateMismatchError,
  PerformanceSyncAlreadyRunningError,
  syncPerformanceJournal,
} from "@/lib/performance/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getPerformanceAdminSession()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: PRIVATE_HEADERS });
  }

  const { id } = await params;
  let fingerprint: unknown;
  try {
    fingerprint = (await request.json()).fingerprint;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (!/^trade-[a-f0-9]+$/.test(id) || typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    await approvePerformanceReviewCandidate(id, fingerprint);
  } catch (error) {
    if (error instanceof PerformanceReviewCandidateMismatchError) {
      return NextResponse.json({ error: "Review candidate changed" }, { status: 409, headers: PRIVATE_HEADERS });
    }
    console.error("[performance/admin/publish] approval failed", error);
    return NextResponse.json({ error: "Approval failed" }, { status: 502, headers: PRIVATE_HEADERS });
  }

  try {
    await syncPerformanceJournal();
    if (!await isPerformanceReviewPublished(id)) {
      return NextResponse.json(
        { published: false, error: "The reviewed result changed or did not pass publication checks" },
        { status: 409, headers: PRIVATE_HEADERS }
      );
    }
    return NextResponse.json({ published: true, tradeId: id }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof PerformanceSyncAlreadyRunningError) {
      return NextResponse.json(
        { published: false, approvalRecorded: true, error: "A sync is already running" },
        { status: 409, headers: PRIVATE_HEADERS }
      );
    }
    console.error("[performance/admin/publish] publication sync failed", error);
    return NextResponse.json(
      { published: false, approvalRecorded: true, error: "Publication was not confirmed" },
      { status: 502, headers: PRIVATE_HEADERS }
    );
  }
}
