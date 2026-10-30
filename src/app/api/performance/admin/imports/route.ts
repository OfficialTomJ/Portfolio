import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { BreakoutInputError } from "@/lib/performance/breakout";
import { BreakoutConflictError, importBreakoutCsv, readBreakoutAccount, readImportHistory } from "@/lib/performance/breakout-store";
import { readBreakoutUpload } from "@/lib/performance/import-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET() {
  if (!await getPerformanceAdminSession()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  try {
    const [account, imports] = await Promise.all([readBreakoutAccount(getDb()), readImportHistory(getDb())]);
    return NextResponse.json({ account, imports }, { headers });
  } catch { return NextResponse.json({ error: "Import history unavailable" }, { status: 503, headers }); }
}

export async function POST(request: NextRequest) {
  const session = await getPerformanceAdminSession();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  try {
    const input = await readBreakoutUpload(request, "confirm");
    const summary = await importBreakoutCsv(getDb(), getMongoClient(), { ...input, userId: session.user.id });
    return NextResponse.json({ ok: true, summary }, { headers });
  } catch (error) {
    const status = error instanceof BreakoutInputError ? 400 : error instanceof BreakoutConflictError || (error as { code?: number })?.code === 11000 ? 409 : 503;
    const message = error instanceof BreakoutInputError || error instanceof BreakoutConflictError ? error.message : status === 409 ? "Another import changed this account. Retry the same file." : "Import could not complete. No partial changes were saved; retry the same file.";
    return NextResponse.json({ ok: false, error: message }, { status, headers });
  }
}
