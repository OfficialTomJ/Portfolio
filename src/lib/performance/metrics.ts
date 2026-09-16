import type {
  EquityPoint,
  PerformanceDataset,
  PerformanceRange,
  PerformanceStats,
  PerformanceTrade,
  PerformanceView,
} from "./types";

const DAY = 86_400_000;

export function signedR(value: number, digits = 2): string {
  if (Math.abs(value) < 0.005) return "0R";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits).replace(/\.00$/, "")}R`;
}

export function sydneyDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function sydneyYear(value: string | Date): number {
  return Number(sydneyDateKey(value).slice(0, 4));
}

export function getAvailableYears(dataset: PerformanceDataset): number[] {
  return Array.from(new Set(dataset.trades.map((item) => sydneyYear(item.closedAt)))).sort(
    (a, b) => b - a
  );
}

function periodStart(range: PerformanceRange, asOf: Date, year: number): Date {
  if (range === "30D") return new Date(asOf.getTime() - 29 * DAY);
  if (range === "60D") return new Date(asOf.getTime() - 59 * DAY);
  if (range === "90D") return new Date(asOf.getTime() - 89 * DAY);
  if (range === "6M") return new Date(asOf.getTime() - 182 * DAY);
  const targetYear = range === "YEAR" ? year : sydneyYear(asOf);
  return new Date(`${targetYear}-01-01T00:00:00+11:00`);
}

function periodEnd(range: PerformanceRange, asOf: Date, year: number): Date {
  if (range !== "YEAR" || year === sydneyYear(asOf)) return asOf;
  return new Date(`${year}-12-31T23:59:59+11:00`);
}

export function calculateStats(trades: PerformanceTrade[]): PerformanceStats {
  const ordered = [...trades].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));
  const winners = ordered.filter((item) => item.resultR > 0);
  const losers = ordered.filter((item) => item.resultR < 0);
  const totalR = ordered.reduce((sum, item) => sum + item.resultR, 0);
  const grossWin = winners.reduce((sum, item) => sum + item.resultR, 0);
  const grossLoss = Math.abs(losers.reduce((sum, item) => sum + item.resultR, 0));
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const item of ordered) {
    running += item.resultR;
    peak = Math.max(peak, running);
    maxDrawdown = Math.min(maxDrawdown, running - peak);
  }

  return {
    totalR,
    tradeCount: ordered.length,
    winRate: ordered.length ? (winners.length / ordered.length) * 100 : null,
    expectancy: ordered.length ? totalR / ordered.length : null,
    profitFactor: grossLoss ? grossWin / grossLoss : winners.length ? Number.POSITIVE_INFINITY : null,
    maxDrawdown,
    averageWinner: winners.length ? grossWin / winners.length : null,
    averageLoser: losers.length ? -grossLoss / losers.length : null,
  };
}

function equitySeries(trades: PerformanceTrade[], start: Date): EquityPoint[] {
  const ordered = [...trades].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));
  let running = 0;
  const firstClose = ordered[0] ? Date.parse(ordered[0].closedAt) : start.getTime() + 1000;
  let previousTime = Math.floor(Math.min(start.getTime(), firstClose - 1000) / 1000);
  const points: EquityPoint[] = [{ time: previousTime, value: 0 }];
  for (const item of ordered) {
    running += item.resultR;
    const closedTime = Math.floor(Date.parse(item.closedAt) / 1000);
    const time = Math.max(closedTime, previousTime + 1);
    points.push({ time, value: running });
    previousTime = time;
  }
  return points;
}

export function buildPerformanceView(
  dataset: PerformanceDataset,
  range: PerformanceRange,
  year: number,
  customRange?: { start: string; end: string }
): PerformanceView {
  const asOf = new Date(dataset.asOf);
  const customStart = customRange?.start ?? sydneyDateKey(asOf);
  const customEnd = customRange?.end ?? sydneyDateKey(asOf);
  const hasCustomRange = range === "CUSTOM";
  const startsAt = hasCustomRange
    ? new Date(`${customStart}T12:00:00Z`)
    : periodStart(range, asOf, year);
  const endsAt = hasCustomRange
    ? new Date(`${customEnd}T12:00:00Z`)
    : periodEnd(range, asOf, year);
  const trades = dataset.trades
    .filter((item) => {
      if (hasCustomRange) {
        const key = sydneyDateKey(item.closedAt);
        return key >= customStart && key <= customEnd;
      }
      const closed = Date.parse(item.closedAt);
      return closed >= startsAt.getTime() && closed <= endsAt.getTime();
    })
    .sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt));

  return {
    trades,
    stats: calculateStats(trades),
    equity: equitySeries(trades, startsAt),
    startsAt,
    endsAt,
    isPartial: hasCustomRange
      ? sydneyDateKey(dataset.inceptionAt) > customStart
      : Date.parse(dataset.inceptionAt) > startsAt.getTime(),
  };
}
