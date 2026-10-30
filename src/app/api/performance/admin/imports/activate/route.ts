import { after, NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { activateBreakoutSource } from "@/lib/performance/journal";
import { BreakoutConflictError } from "@/lib/performance/breakout-store";
import { readBoundedBody } from "@/lib/performance/import-request";
import { publishCurrentPerformanceSocialImages } from "@/lib/performance/social-image-publisher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function POST(request: NextRequest) {
  if (!await getPerformanceAdminSession()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  let revision: unknown;
  try { revision = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 1024))).revision; }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
  if (typeof revision !== "number") return NextResponse.json({ error: "Invalid revision" }, { status: 400, headers });
  try {
    await activateBreakoutSource(getDb(), getMongoClient(), revision);
    after(async () => { try { await publishCurrentPerformanceSocialImages(); } catch { console.error("[performance/images] source-switch image refresh failed"); } });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof BreakoutConflictError ? error.message : "Source switch could not be confirmed. Refresh before retrying." }, { status: error instanceof BreakoutConflictError ? 409 : 503, headers }); }
}
