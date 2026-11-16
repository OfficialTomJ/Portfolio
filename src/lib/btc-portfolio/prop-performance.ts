import { z } from "zod";
import type { PublicPortfolio } from "./schema";
const at = z.iso.datetime({ offset: true });
const point = z.object({ at, portfolioIndex: z.number().finite().positive(), btcIndex: z.number().finite().positive() }).strict();
export const currentPerformanceProjectionSchema = z.object({
  status: z.literal("approved-localhost"), method: z.literal("spot-and-closed-prop-results"), spotFingerprint: z.string().length(64),
  inceptionAt: at, asOf: at, propThrough: at, propTradeCount: z.number().int().positive(), points: z.array(point).min(2).max(10000),
}).strict();
export interface PropResult { id: string; openedAt: string; closedAt: string; resultR: number }

/** Closed results settle into cash; asset quantities stay fixed while the equity denominator changes. */
export function combineCurrentPortfolioResults(current: PublicPortfolio, input: z.infer<typeof currentPerformanceProjectionSchema>): PublicPortfolio {
  const data = currentPerformanceProjectionSchema.parse(input), spotValue = current.points.at(-1)!.portfolioIndex, totalValue = data.points.at(-1)!.portfolioIndex;
  if (data.points.length !== current.points.length || data.points.some((point, i) => point.at !== current.points[i].at || point.btcIndex !== current.points[i].btcIndex)) throw new Error("Prop results must preserve the spot valuation calendar and BTC benchmark.");
  const scale = spotValue / totalValue, cashChange = (totalValue - spotValue) / totalValue * 100;
  const allocation = current.allocation.map(row => ({ ...row, weight: row.weight * scale }));
  const cash = allocation.find(row => row.type === "cash" && row.account === "margin");
  if (cash) cash.weight += cashChange;
  else allocation.push({ account: "margin", asset: "USD", type: "cash", direction: "long", weight: cashChange });
  return { ...current, points: data.points.map(point => ({ ...point, weights: {} })), allocation,
    cashPct: current.cashPct * scale + cashChange, investedPct: current.investedPct * scale, netPct: current.netPct * scale,
    performanceCoverage: { method: data.method, propThrough: data.propThrough, propTradeCount: data.propTradeCount, openPropPnlIncluded: false },
  };
}

/** Private owner-supplied mapping, never a general definition of R or a public allocation. */
export function applyPropResults(spot: PublicPortfolio["points"], trades: PropResult[], riskFraction: number) {
  if (!spot.length || !Number.isFinite(riskFraction) || riskFraction <= 0 || riskFraction > 1) throw new Error("A valid owner-confirmed risk mapping is required.");
  const first = Date.parse(spot[0].at), last = Date.parse(spot.at(-1)!.at);
  spot.forEach((p, i) => { point.parse({ at: p.at, portfolioIndex: p.portfolioIndex, btcIndex: p.btcIndex }); if (i && Date.parse(p.at) <= Date.parse(spot[i - 1].at)) throw new Error("Spot marks must increase."); });
  if (new Set(trades.map(t => t.id)).size !== trades.length) throw new Error("Duplicate prop result.");
  for (const trade of trades) {
    const opened = Date.parse(trade.openedAt), closed = Date.parse(trade.closedAt);
    if (!Number.isFinite(trade.resultR) || !Number.isFinite(opened) || !Number.isFinite(closed) || opened < first || closed > last || closed <= opened) throw new Error("Prop results must be closed, priced and inside the spot period.");
  }
  const events = trades.flatMap(trade => [{ at: trade.openedAt, kind: "open" as const, trade }, { at: trade.closedAt, kind: "close" as const, trade }])
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (a.kind === b.kind ? a.trade.id.localeCompare(b.trade.id) : a.kind === "close" ? -1 : 1));
  const riskAtEntry = new Map<string, number>();
  let cursor = 0, mark = 0, realised = 0;
  const journal: { id: string; riskIndex: number; pnlIndex: number }[] = [];
  const points = spot.map(sample => {
    while (cursor < events.length && Date.parse(events[cursor].at) <= Date.parse(sample.at)) {
      const event = events[cursor++];
      while (mark + 1 < spot.length && Date.parse(spot[mark + 1].at) <= Date.parse(event.at)) mark++;
      if (event.kind === "open") {
        const equity = spot[mark].portfolioIndex + realised;
        if (equity <= 0) throw new Error("Non-positive entry equity.");
        riskAtEntry.set(event.trade.id, equity * riskFraction);
      } else {
        const riskIndex = riskAtEntry.get(event.trade.id);
        if (riskIndex === undefined) throw new Error("Missing entry risk basis.");
        const pnlIndex = riskIndex * event.trade.resultR; realised += pnlIndex;
        journal.push({ id: event.trade.id, riskIndex, pnlIndex });
      }
    }
    return point.parse({ at: sample.at, portfolioIndex: sample.portfolioIndex + realised, btcIndex: sample.btcIndex });
  });
  if (cursor !== events.length) throw new Error("Uncovered prop results.");
  return { points, journal, propThrough: trades.map(t => t.closedAt).sort().at(-1) ?? null };
}
