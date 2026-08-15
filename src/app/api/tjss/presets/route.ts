import { NextResponse } from "next/server";
import { requireMemberApi } from "@/lib/session";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  getPresetSummaries,
  getModes,
  getEvidence,
  MissingStrategyError,
} from "@/lib/tjss/presets";

// GET /api/tjss/presets
// Members-only. The dashboard's bootstrap call: which strategies and allocation
// modes exist, and the evidence copy for the backtest panel.
//
// Returns LABELS ONLY, id, display name, plain-English description. The tuned
// parameters behind each preset stay in Mongo and never leave the server.

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireMemberApi();
  if (gate instanceof NextResponse) return gate;

  const limited = await checkRateLimit(`tjss-presets:${gate.user.id}`, 60, 60);
  if (limited) return limited;

  try {
    const [presets, modes, evidence] = await Promise.all([
      getPresetSummaries(),
      getModes(),
      getEvidence(),
    ]);
    return NextResponse.json({
      presets,
      modes: modes.map(({ id, label, hint, behaviour, tradeoff }) => ({
        id,
        label,
        hint,
        behaviour: behaviour ?? [],
        tradeoff: tradeoff ?? "",
      })),
      evidence,
    });
  } catch (err) {
    if (err instanceof MissingStrategyError) {
      console.error("[tjss/presets]", err.message);
      return NextResponse.json({ error: "Strategy unavailable" }, { status: 503 });
    }
    console.error("[tjss/presets]", err);
    return NextResponse.json({ error: "Failed to load strategy" }, { status: 502 });
  }
}
