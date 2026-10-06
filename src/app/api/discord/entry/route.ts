import { NextRequest, NextResponse } from "next/server";
import { getCommunity } from "@/lib/community/runtime";
import { errorResponse, requestIP, setFlowCookie } from "@/lib/community/http";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const { config, service, onboarding } = getCommunity();
    if (!onboarding) return new Response("Return to Discord and start verification again.", { status: 503 });
    const expectedDiscordId = await onboarding.entry(request.nextUrl.searchParams.get("ticket") ?? "");
    const { token, state } = await service.start(requestIP(request), "connect", expectedDiscordId);
    const authorize = new URL("https://discord.com/oauth2/authorize");
    authorize.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
      response_type: "code", scope: "identify", state, prompt: "consent" }).toString();
    const response = NextResponse.redirect(authorize, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    setFlowCookie(response, token, config);
    return response;
  } catch (error) { return errorResponse(error); }
}
