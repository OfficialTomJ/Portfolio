import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { BreakoutInputError } from "@/lib/performance/breakout";
import { BreakoutConflictError, previewBreakoutCsv } from "@/lib/performance/breakout-store";
import { readBreakoutUpload } from "@/lib/performance/import-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: NextRequest) {
  if (!await getPerformanceAdminSession()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  try {
    const input = await readBreakoutUpload(request);
    const preview = await previewBreakoutCsv(getDb(), getMongoClient(), input);
    return NextResponse.json({ ok: true, preview }, { headers });
  } catch (error) {
    const status = error instanceof BreakoutInputError ? 400 : error instanceof BreakoutConflictError ? 409 : 503;
    return NextResponse.json({ ok: false, error: error instanceof BreakoutInputError || error instanceof BreakoutConflictError ? error.message : "Preview unavailable. Nothing was saved; try again." }, { status, headers });
  }
}
