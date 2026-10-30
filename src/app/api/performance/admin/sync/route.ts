import { NextResponse } from "next/server";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
export async function POST() {
  if (!await getPerformanceAdminSession()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ error: "Bybit sync is retired. Upload a Breakout CSV." }, { status: 410, headers: { "Cache-Control": "private, no-store" } });
}
