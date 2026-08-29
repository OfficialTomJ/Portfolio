import { NextRequest, NextResponse } from "next/server";
import { requireMemberApi } from "@/lib/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { getAlignedBars } from "@/lib/tjss/market";
import { runBacktest } from "@/lib/tjss/backtest";
import { computeRiskMetrics } from "@/lib/tjss/metrics";
import { getPreset, toBacktestConfig, MissingStrategyError } from "@/lib/tjss/presets";
import { backtestRequestSchema, toUnixDay } from "@/lib/tjss/schema";

// POST /api/tjss/backtest
// Members-only. Simulates the stored strategy over history.
//
// The request carries the member's own inputs, preset, allocation mode,
// capital, contributions, date range. Sizing fractions and execution
// assumptions come from the preset in Mongo and are not overridable.
//
// Risk metrics are computed here rather than in the browser so the equity-curve
// math stays server-side alongside the engine.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireMemberApi();
  if (gate instanceof NextResponse) return gate;

  const limited = await checkRateLimit(`tjss-backtest:${gate.user.id}`, 30, 60);
  if (limited) return limited;

  const parsed = backtestRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const preset = await getPreset(input.preset);

    let bars = await getAlignedBars();
    const from = toUnixDay(input.fromDate);
    const to = toUnixDay(input.toDate);
    if (to != null) bars = bars.filter((b) => b.time <= to);

    // `fromDate` is NOT applied by slicing the bars away. The indicators need
    // history before the first traded bar to warm up: the 50-month EMA wants
    // years of it, and starting the array at the requested date left deepValue
    // dark and weeklyBull false for roughly a year, forcing a bear regime and
    // silently reporting numbers that were simply wrong. runBacktest.startTime
    // keeps those bars for warm-up only, out of the trades, the equity curve
    // and the benchmark.
    const config = toBacktestConfig(preset, input);
    if (from != null) config.startTime = from;

    const tradableBars = from == null ? bars.length : bars.filter((b) => b.time >= from).length;
    if (tradableBars < 30) {
      return NextResponse.json(
        { error: "Not enough data in the selected range" },
        { status: 400 }
      );
    }

    const result = runBacktest(bars, config);
    // Both curves receive the same deposits, so both have them stripped before
    // returns are measured, and both are annualised money-weighted when
    // contributions are on. Otherwise each deposit reads as a one-bar gain.
    const risk = computeRiskMetrics(
      result.equity.map((p) => ({ time: p.time, equity: p.equity })),
      { cashflows: result.cashflows, cagrPct: result.stats.cagrPct }
    );
    const buyHoldRisk = computeRiskMetrics(
      result.equity.map((p) => ({ time: p.time, equity: p.buyHold })),
      { cashflows: result.cashflows, cagrPct: result.stats.buyHoldCagrPct }
    );

    return NextResponse.json({ ...result, risk, buyHoldRisk, presetId: preset.id });
  } catch (err) {
    if (err instanceof MissingStrategyError) {
      console.error("[tjss/backtest]", err.message);
      return NextResponse.json({ error: "Strategy unavailable" }, { status: 503 });
    }
    console.error("[tjss/backtest]", err);
    return NextResponse.json({ error: "Backtest failed" }, { status: 502 });
  }
}
