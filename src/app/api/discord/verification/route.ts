import { after, NextRequest } from "next/server";
import { z } from "zod";
import { getCommunity } from "@/lib/community/runtime";
import { checkOrigin } from "@/lib/community/security";
import { CommunityError } from "@/lib/community/model";
import { cookieToken, errorResponse, json, requestIP, setFlowCookie } from "@/lib/community/http";

export const runtime = "nodejs";
export const maxDuration = 60;
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), purpose: z.enum(["connect", "manage"]).default("connect") }),
  z.object({ action: z.literal("send"), email: z.string().max(254), accepted: z.boolean().default(false) }),
  z.object({ action: z.literal("confirm"), code: z.string().max(6) }),
  z.object({ action: z.literal("retry") }), z.object({ action: z.literal("disconnect") }),
]);

export async function GET(request: NextRequest) {
  try {
    const { service, config } = getCommunity();
    if (!request.cookies.has("community-verification")) return json({ stage: "new", test: config.mode === "test", inviteUrl: config.inviteUrl });
    return json({ ...await service.status(cookieToken(request)), test: config.mode === "test", inviteUrl: config.inviteUrl });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { service, config } = getCommunity();
    checkOrigin(request.headers.get("origin"), config.origin);
    if (Number(request.headers.get("content-length")) > 2048) throw new CommunityError("body", "Request is too large.", 413);
    const text = await request.text();
    if (text.length > 2048) throw new CommunityError("body", "Request is too large.", 413);
    let input;
    try { input = bodySchema.parse(JSON.parse(text)); }
    catch { throw new CommunityError("body", "Invalid verification request."); }
    const ip = requestIP(request);
    if (input.action === "start") {
      const { token, state } = await service.start(ip, input.purpose);
      const authorize = new URL("https://discord.com/oauth2/authorize");
      authorize.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
        response_type: "code", scope: "identify", state, prompt: "consent" }).toString();
      const response = json(input.purpose === "connect" ? { redirect: authorize.href } : await service.status(token));
      setFlowCookie(response, token, config);
      return response;
    }
    const token = cookieToken(request);
    after(async () => {
      try {
        const { onboarding, repo } = getCommunity();
        const flow = await repo.flow(service.flowId(token), new Date());
        if (onboarding && flow?.discord) await onboarding.processDue(new Date(Date.now() + 10_000), flow.discord.id);
      } catch { console.warn("[community] Private status update queued for recovery."); }
    });
    if (input.action === "send") return json(await service.send(token, input.email, ip, input.accepted));
    if (input.action === "confirm") {
      await service.confirm(token, input.code, ip);
      // Durable jobs are committed before any external role/list calls. Provider failures preserve proof.
      return json(await service.retry(token));
    }
    if (input.action === "disconnect") return json(await service.disconnect(token));
    return json(await service.retry(token));
  } catch (error) { return errorResponse(error); }
}
