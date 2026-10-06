import { NextRequest, NextResponse } from "next/server";
import type { CommunityConfig } from "./config";
import { CommunityError, FLOW_MS } from "./model";
import { ProviderError } from "./service";

export const FLOW_COOKIE = "community-verification";
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
export function errorResponse(error: unknown) {
  if (error instanceof CommunityError) return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof ProviderError) return json({ error: error.publicMessage, code: "provider" }, 503);
  console.warn("[community] Request failed; verify provider and database configuration.");
  return json({ error: "Verification is temporarily unavailable. Please retry shortly.", code: "unavailable" }, 503);
}
export function cookieToken(request: NextRequest) {
  const token = request.cookies.get(FLOW_COOKIE)?.value;
  if (!token) throw new CommunityError("session", "Start verification again.", 401);
  return token;
}
export function setFlowCookie(response: NextResponse, token: string, config: CommunityConfig) {
  response.cookies.set(FLOW_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: config.origin.startsWith("https:"),
    path: "/api/discord", maxAge: FLOW_MS / 1000 });
}
export function requestIP(request: NextRequest) {
  // Vercel replaces this header. Never trust a caller-controlled X-Forwarded-For outside that platform.
  return process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown" : "local";
}
