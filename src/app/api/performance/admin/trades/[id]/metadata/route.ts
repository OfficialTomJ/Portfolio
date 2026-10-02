import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { AnnotationConflictError, AnnotationInputError, AnnotationTargetError, getTagCatalogue, getTradeAnnotations, resolveAnnotationTarget, saveTradeAnnotation } from "@/lib/performance/annotations";
import { getAdminPerformanceTrade } from "@/lib/performance/admin-data";
import type { AdminPublication } from "@/lib/performance/admin-publication";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  if (!await getPerformanceAdminSession()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const { id } = await params;
  const target = await resolveAnnotationTarget(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const [annotations, tags, result] = await Promise.all([getTradeAnnotations([id]), getTagCatalogue(), target.closed ? getAdminPerformanceTrade(id) : null]);
  if (target.closed && !result) return NextResponse.json({ error: "Trade is no longer available for review" }, { status: 404, headers });
  const publication: AdminPublication = !result ? { status: "active" } : result.status === "published"
    ? { status: "published", trade: result.trade }
    : { status: "unpublished", trade: result.trade, fingerprint: result.fingerprint! };
  return NextResponse.json({ annotation: annotations[id], tags, closed: target.closed, publication }, { headers });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const session = await getPerformanceAdminSession();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  if (Number(request.headers.get("content-length")) > 40000) return NextResponse.json({ error: "Edit is too large" }, { status: 413, headers });
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid edit" }, { status: 400, headers }); }
  try {
    const annotation = await saveTradeAnnotation(id, body, session.user.id);
    return NextResponse.json({ annotation }, { headers });
  } catch (error) {
    if (error instanceof AnnotationConflictError) return NextResponse.json({ error: error.message }, { status: 409, headers });
    if (error instanceof AnnotationTargetError) return NextResponse.json({ error: error.message }, { status: 404, headers });
    // Validation messages contain no credentials or private field contents.
    if (error instanceof AnnotationInputError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("[performance/metadata] save failed");
    return NextResponse.json({ error: "Could not save this edit. Please try again." }, { status: 500, headers });
  }
}
