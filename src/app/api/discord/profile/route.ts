import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getCommunity } from "@/lib/community/runtime";
import { CommunityError } from "@/lib/community/model";
import { checkOrigin } from "@/lib/community/security";
import { errorResponse, json } from "@/lib/community/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    // Intentionally bypass the site's synthetic development session.
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user.emailVerified) throw new CommunityError("account", "Sign in with a verified Mentor account to view its connection.", 401);
    return json(await getCommunity().service.profile(session.user));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { service, config } = getCommunity();
    checkOrigin(request.headers.get("origin"), config.origin);
    // The account identity comes exclusively from Better Auth, never from the request body.
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user.emailVerified) throw new CommunityError("account", "Sign in with a verified Mentor account to manage its connection.", 401);
    if (Number(request.headers.get("content-length")) > 2048) throw new CommunityError("body", "Request is too large.", 413);
    const text = await request.text();
    if (text.length > 2048) throw new CommunityError("body", "Request is too large.", 413);
    let input;
    try { input = z.object({ action: z.enum(["disconnect", "retry"]) }).strict().parse(JSON.parse(text)); }
    catch { throw new CommunityError("body", "Invalid connection request."); }
    return json(input.action === "disconnect" ? await service.disconnectAccount(session.user) : await service.retryAccount(session.user));
  } catch (error) { return errorResponse(error); }
}
