import type { PublicSpotDataset, SpotPoint } from "./types";
export const SPOT_COLOURS: Record<string, string> = { BTC: "#f5a524", ETH: "#9b9bff", SOL: "#54d6b2", HYPE: "#a1edca", USDT: "#64748b" };
export const spotColour = (asset: string) => SPOT_COLOURS[asset] ?? "#c4a5e8";
export const signedPct = (value: number, digits = 2) => `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
export const dateLabel = (value: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
export function spotMetrics(points: SpotPoint[]) {
  const first = points[0], last = points.at(-1);
  if (!first || !last) return null;
  const portfolio = (last.portfolioIndex / first.portfolioIndex - 1) * 100, btc = (last.btcIndex / first.btcIndex - 1) * 100;
  const drawdown = (key: "portfolioIndex" | "btcIndex") => {
    let peak = points[0][key], maximum = 0;
    for (const p of points) { peak = Math.max(peak, p[key]); maximum = Math.min(maximum, (p[key] / peak - 1) * 100); }
    return maximum;
  };
  return { portfolio, btc, excess: portfolio - btc, relative: ((1 + portfolio / 100) / (1 + btc / 100) - 1) * 100, drawdown: drawdown("portfolioIndex"), btcDrawdown: drawdown("btcIndex") };
}
export function spotRange(dataset: PublicSpotDataset, range: string, start = "", end = "") {
  const last = new Date(dataset.asOf), day = 86400000;
  let starts = Date.parse(dataset.inceptionAt), ends = Date.parse(dataset.asOf);
  if (range === "YTD") starts = Math.max(starts, Date.UTC(last.getUTCFullYear(), 0, 1));
  if (["1M", "3M", "6M", "1Y"].includes(range)) starts = Math.max(starts, ends - ({ "1M": 30, "3M": 90, "6M": 180, "1Y": 365 }[range] ?? 0) * day);
  if (range === "CUSTOM") { starts = Date.parse(`${start}T00:00:00Z`); ends = Math.min(ends, Date.parse(`${end}T23:59:59.999Z`)); }
  return dataset.points.filter(p => Date.parse(p.at) >= starts && Date.parse(p.at) <= ends);
}

/** Calendar progress is separate from recorded executions; missed intervals never invent fills. */
export function dcaProgress(plan: { startAt: string | null; durationDays: number | null; status: "active" | "paused" | "completed" }, asOf: string) {
  const elapsed = plan.startAt ? Math.floor((Date.parse(asOf) - Date.parse(plan.startAt)) / 86400000) + 1 : 0;
  const day = Math.max(0, Math.min(elapsed, plan.durationDays ?? Infinity));
  const ended = plan.durationDays !== null && elapsed > plan.durationDays;
  const label = plan.status === "completed" ? "Completed" : ended ? "Schedule ended" : plan.status === "paused" ? "Paused" : elapsed <= 0 ? "Scheduled" : "Active";
  return { day, label, percent: plan.durationDays ? day / plan.durationDays * 100 : null };
}

export function groupSpotActivity(activity: PublicSpotDataset["activity"]) {
  const groups = new Map<string, PublicSpotDataset["activity"]>();
  for (const event of [...activity].sort((a, b) => b.at.localeCompare(a.at))) {
    const key = event.campaignId ? `dca:${event.campaignId}` : event.decisionId ? `decision:${event.decisionId}` : `event:${event.id}`;
    const group = groups.get(key) ?? [];
    group.push(event); groups.set(key, group);
  }
  return [...groups.entries()].map(([id, events]) => ({ id, events, latest: events[0] }));
}
