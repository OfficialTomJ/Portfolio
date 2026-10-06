import { after } from "next/server";
import { getCommunity } from "@/lib/community/runtime";
import { parseButtonInteraction, privateDeferred, privateReply, validDiscordSignature } from "@/lib/community/interaction-security";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 65_536) return new Response(null, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 65_536) return new Response(null, { status: 413 });
  if (!validDiscordSignature(body, request.headers, process.env.DISCORD_PUBLIC_KEY ?? "")) return new Response(null, { status: 401 });
  let payload;
  try { payload = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
  if (payload?.type === 1) return Response.json({ type: 1 });
  try {
    const { config, repo, onboarding } = getCommunity();
    const interaction = parseButtonInteraction(payload, { ...config, channelId: process.env.DISCORD_VERIFY_CHANNEL_ID ?? "" });
    if (!interaction || !onboarding) return Response.json(privateReply("Verification is not available in this channel."));
    // Acknowledge before database/provider work, within Discord's three-second deadline.
    after(async () => {
      try { await onboarding.handle(interaction, repo.limit.bind(repo)); }
      catch { console.warn("[community] Private Discord reply deferred; click Check status to retry."); }
    });
    return Response.json(privateDeferred);
  } catch { return Response.json(privateReply("Verification is temporarily unavailable. Please try again shortly.")); }
}
