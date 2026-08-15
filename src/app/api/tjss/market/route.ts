import { NextRequest, NextResponse } from "next/server";
import { requireMemberApi } from "@/lib/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { getAlignedBars } from "@/lib/tjss/market";
import { computeSignals } from "@/lib/tjss/rules";
import { getPreset, toSignalConfig, MissingStrategyError } from "@/lib/tjss/presets";
import { buildChartView } from "@/lib/tjss/view";
import { marketQuerySchema } from "@/lib/tjss/schema";
import { classify } from "@/lib/tjss/types";

// GET /api/tjss/market?preset=&mode=&tf=&emas=
// Members-only. Runs the signal engine server-side against the preset stored in
// Mongo and returns a display-ready chart payload plus the current actionable
// state.
//
// The four query params are the member's own view choices. No strategy
// parameter is accepted from, or returned to, the client.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireMemberApi();
  if (gate instanceof NextResponse) return gate;

  const limited = await checkRateLimit(`tjss-market:${gate.user.id}`, 60, 60);
  if (limited) return limited;

  const q = req.nextUrl.searchParams;
  const parsed = marketQuerySchema.safeParse({
    preset: q.get("preset") ?? undefined,
    mode: q.get("mode") ?? undefined,
    tf: q.get("tf") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { preset: presetId, mode, tf } = parsed.data;

  try {
    const preset = await getPreset(presetId);
    const config = toSignalConfig(preset, mode);

    const bars = await getAlignedBars();
    const signals = computeSignals(bars, config);
    const view = buildChartView(bars, signals, config, tf);

    const lastFng = view.fng.length ? view.fng[view.fng.length - 1].value : null;

    return NextResponse.json({
      ...view,
      current: signals.current,
      meta: {
        presetId: preset.id,
        timeframe: tf,
        lastFng,
        lastFngClassification: lastFng != null ? classify(lastFng) : null,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof MissingStrategyError) {
      console.error("[tjss/market]", err.message);
      return NextResponse.json({ error: "Strategy unavailable" }, { status: 503 });
    }
    console.error("[tjss/market]", err);
    return NextResponse.json({ error: "Failed to load market data" }, { status: 502 });
  }
}
