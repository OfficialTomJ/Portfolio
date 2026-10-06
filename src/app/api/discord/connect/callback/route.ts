import { NextRequest, NextResponse } from "next/server";
import { getCommunity } from "@/lib/community/runtime";
import { cookieToken, errorResponse } from "@/lib/community/http";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let origin: string;
  try {
    const { service, config } = getCommunity(); origin = config.origin;
    try {
      await service.callback(cookieToken(request), request.nextUrl.searchParams.get("state") ?? "",
        request.nextUrl.searchParams.get("code") ?? "");
    } catch {
      return NextResponse.redirect(new URL("/discord/verify?authorization=failed", origin),
        { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    }
    return NextResponse.redirect(new URL("/discord/verify", origin),
      { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return errorResponse(error); }
}
