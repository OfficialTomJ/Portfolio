import type { PublicPortfolio } from "./schema";

export const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
export const PORTFOLIO_TIME_ZONE = "UTC";
export const date = (at: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: PORTFOLIO_TIME_ZONE }).format(new Date(at));
const calendarYear = new Intl.DateTimeFormat("en-AU", { year: "numeric", timeZone: PORTFOLIO_TIME_ZONE });
export function portfolioYears(data: Pick<PublicPortfolio, "points">) {
  return [...new Set(data.points.map(p => Number(calendarYear.format(new Date(p.at)))))].sort((a, b) => b - a);
}

/** Filters only offer assets with visible, non-fee activity in the selected period. */
export function portfolioActivityView(activity: PublicPortfolio["activity"], first: string | undefined, last: string | undefined, requestedAsset = "") {
  const eligible = activity.filter(event => first && last && event.at >= first && event.at <= last && event.kind !== "fee");
  const availableAssets = [...new Set(eligible.map(event => event.asset))].sort();
  const selectedAsset = availableAssets.some(asset => asset === requestedAsset) ? requestedAsset : "";
  const groups = new Map<string, PublicPortfolio["activity"]>();
  for (const event of eligible.filter(event => !selectedAsset || event.asset === selectedAsset).sort((a, b) => b.at.localeCompare(a.at))) {
    const key = event.campaignId ? `campaign:${event.campaignId}` : `event:${event.id}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return { availableAssets, selectedAsset, groups: [...groups.values()] };
}

/** Add execution-only allocation deltas, never first/last weights that include intervening price drift. */
export function activityAllocationChanges(group: PublicPortfolio["activity"]) {
  const totals = new Map<string, number>();
  for (const event of group) for (const change of event.allocationChanges ?? []) totals.set(change.asset, (totals.get(change.asset) ?? 0) + change.deltaPct);
  return [...totals].filter(([, value]) => Math.abs(value) >= .005).map(([asset, deltaPct]) => ({ asset, deltaPct }))
    .sort((a, b) => a.asset === "CASH" ? 1 : b.asset === "CASH" ? -1 : Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}
export function metrics(points: PublicPortfolio["points"]) {
  if (points.length < 2) return null;
  const first = points[0], last = points.at(-1)!;
  const portfolio = (last.portfolioIndex / first.portfolioIndex - 1) * 100, btc = (last.btcIndex / first.btcIndex - 1) * 100;
  let peak = first.portfolioIndex, relativePeak = first.portfolioIndex / first.btcIndex, drawdown = 0, relativeDrawdown = 0;
  for (const p of points) {
    peak = Math.max(peak, p.portfolioIndex); drawdown = Math.min(drawdown, (p.portfolioIndex / peak - 1) * 100);
    const relative = p.portfolioIndex / p.btcIndex; relativePeak = Math.max(relativePeak, relative); relativeDrawdown = Math.min(relativeDrawdown, (relative / relativePeak - 1) * 100);
  }
  return { portfolio, btc, difference: portfolio - btc, relative: ((1 + portfolio / 100) / (1 + btc / 100) - 1) * 100, drawdown, relativeDrawdown };
}
export function periodPoints(data: PublicPortfolio, period: string, from: string, to: string) {
  const end = Date.parse(data.asOf), initial = Date.parse(data.inceptionAt);
  let start = initial, cutoff = end;
  if (period === "YTD") {
    const year = Number(calendarYear.format(new Date(end)));
    start = Math.max(initial, utcMidnight(`${year}-01-01`));
  }
  if (/^YEAR:\d{4}$/.test(period)) {
    const year = Number(period.slice(5));
    start = Math.max(initial, utcMidnight(`${year}-01-01`));
    cutoff = Math.min(end, utcMidnight(`${year + 1}-01-01`) - 1);
  }
  const days: Record<string, number> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };
  if (days[period]) start = Math.max(initial, end - days[period] * 86400000);
  // Calendar filters use UTC boundaries, independent of browser timezone or daylight saving.
  if (period === "CUSTOM") {
    start = utcMidnight(from); cutoff = Math.min(end, utcMidnight(nextDate(to)) - 1);
  }
  return data.points.filter(p => Date.parse(p.at) >= start && Date.parse(p.at) <= cutoff);
}
function nextDate(value: string) { const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
export function utcMidnight(value: string) { return Date.parse(`${value}T00:00:00Z`); }

/** Fixed UTC components keep server and browser midnight rendering identical. */
export function portfolioUpdateTime(at: string) {
  const value = new Date(at);
  if (!Number.isFinite(value.getTime())) throw new RangeError("Invalid portfolio timestamp.");
  return [value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds()].map(part => String(part).padStart(2, "0")).join(":") + " UTC";
}
