import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { createTradeTag } from "@/lib/performance/annotations";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function POST(request: NextRequest) {
  const session = await getPerformanceAdminSession();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  try {
    const body = await request.json();
    const tag = await createTradeTag(body.name, session.user.id);
    return NextResponse.json({ tag }, { headers });
  } catch {
    return NextResponse.json({ error: "Could not create tag. Use a name of 1–40 characters." }, { status: 400, headers });
  }
}
