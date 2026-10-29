import { after, NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { publishStoredTrade } from "@/lib/performance/journal";
import { BreakoutConflictError } from "@/lib/performance/breakout-store";
import { readBoundedBody } from "@/lib/performance/import-request";
import { publishCurrentPerformanceSocialImages } from "@/lib/performance/social-image-publisher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function GET() { return NextResponse.json({ error: "Not found" }, { status: 404, headers }); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getPerformanceAdminSession()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const { id } = await params;
  let fingerprint: unknown;
  try { fingerprint = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 1024))).fingerprint; }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
  if (!/^trade-[a-f0-9]{20}$/.test(id) || typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint)) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  try {
    await publishStoredTrade(getDb(), getMongoClient(), id, fingerprint);
    after(async () => { try { await publishCurrentPerformanceSocialImages(); } catch { console.error("[performance/images] post-publication refresh failed"); } });
    return NextResponse.json({ published: true, tradeId: id }, { headers });
  } catch (error) {
    return NextResponse.json({ published: false, error: error instanceof BreakoutConflictError ? error.message : "Publication could not be confirmed. Refresh before retrying." },
      { status: error instanceof BreakoutConflictError ? 409 : 503, headers });
  }
}
