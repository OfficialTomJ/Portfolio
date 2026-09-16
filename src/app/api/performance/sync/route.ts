import { NextRequest, NextResponse } from "next/server";
import { syncPerformanceJournal } from "@/lib/performance/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
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
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[performance/sync]", error);
    return NextResponse.json({ error: "Performance sync failed" }, { status: 502 });
  }
}
