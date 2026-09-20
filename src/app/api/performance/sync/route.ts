import { NextRequest, NextResponse } from "next/server";
import {
  PerformanceSyncAlreadyRunningError,
  syncPerformanceJournal,
} from "@/lib/performance/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "syd1";
export const maxDuration = 60;

async function handleSync(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret) {
    return NextResponse.json({ error: "Performance sync is not configured" }, { status: 503 });
  }
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncPerformanceJournal();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof PerformanceSyncAlreadyRunningError) {
      return NextResponse.json(
        { ok: true, skipped: "already_running" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("[performance/sync]", error);
    return NextResponse.json(
      { ok: false, error: "Performance sync failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export const GET = handleSync;
export const POST = handleSync;
