import { NextRequest } from "next/server";
import { getCommunity } from "@/lib/community/runtime";
import { errorResponse, json } from "@/lib/community/http";
import { authorizeProcessor, checkProcessorTarget } from "@/lib/community/processor-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
async function handle(request: NextRequest, runRecovery: boolean) {
  try {
    authorizeProcessor(request.headers, process.env.COMMUNITY_PROCESS_SECRET);
    const { config, worker } = getCommunity();
    checkProcessorTarget(request.headers, config);
    const result = runRecovery ? await worker.run() : await worker.status();
    return json({ ok: true, environment: config.mode, guildId: config.guildId, ...result });
  } catch (error) { return errorResponse(error); }
}
// GET is an authenticated read-only health check; only POST performs recovery.
export function GET(request: NextRequest) { return handle(request, false); }
export function POST(request: NextRequest) { return handle(request, true); }
