import type { IdeaTrade } from "./ideas-model";
import type { PerformanceTrade, TradeDirection } from "./types";
import { publicTradeIdForCycle } from "./publication";
import { validatePublishedPerformanceTrade } from "./sync-validation";

export interface IdeaCycleSource {
  _id: string;
  symbol: string;
  direction: TradeDirection;
  openedAt: Date;
  closedAt?: Date;
  entryPrice: number;
  quantity?: number;
  status: string;
  excludedFromJournal?: boolean;
  publicationHold?: boolean;
  reviewCandidate?: PerformanceTrade;
  reviewFingerprint?: string;
  riskAmount?: number;
}
export interface IdeaPnlSource { cycleId?: string; closedPnl: string; execType: string }

/** Only scoped cycles enter this loader; public rows alone cannot introduce another account. */
export function selectIdeaTrades(cycles: IdeaCycleSource[], published: PerformanceTrade[], pnl: IdeaPnlSource[]): IdeaTrade[] {
  const publicById = new Map(published.map(t => [t.id, t]));
  const pnlByCycle = new Map<string, number[]>();
  for (const p of pnl) {
    if (p.execType !== "Trade" || !p.cycleId || !Number.isFinite(Number(p.closedPnl))) continue;
    const values = pnlByCycle.get(p.cycleId) ?? [];
    values.push(Number(p.closedPnl)); pnlByCycle.set(p.cycleId, values);
  }
  const closed = cycles.filter(c => c.status !== "open" && c.openedAt instanceof Date && Number.isFinite(c.openedAt.getTime()) &&
    c.closedAt instanceof Date && Number.isFinite(c.closedAt.getTime()) && c.closedAt > c.openedAt);
  const selected: IdeaTrade[] = closed.map(c => {
    const id = publicTradeIdForCycle(c._id);
    const excluded = c.excludedFromJournal || c.status === "excluded";
    const pub = publicById.get(id);
    const candidate = c.reviewCandidate;
    const trade = !excluded && !c.publicationHold
      ? c.status === "published" && pub && !validatePublishedPerformanceTrade(pub) ? pub
        : c.status === "pending_review" && candidate?.id === id && /^[a-f0-9]{64}$/.test(c.reviewFingerprint ?? "") && !validatePublishedPerformanceTrade(candidate) ? candidate : null
      : null;
    const slices = pnlByCycle.get(c._id);
    const mismatch = !!trade && !!slices?.length && !!c.riskAmount &&
      Math.abs(slices.reduce((s, x) => s + x, 0) / c.riskAmount - trade.resultR) > 0.000001;
    return {
      id, symbol: c.symbol, direction: c.direction,
      openedAt: trade?.openedAt ?? c.openedAt.toISOString(), closedAt: trade?.closedAt ?? c.closedAt!.toISOString(),
      resultR: trade?.resultR ?? null, status: excluded ? "excluded" : c.status,
      exception: !trade, duplicateOf: null,
      warning: excluded ? "Excluded from journal results. You can group this trade; its result is omitted from totals."
        : !trade ? "Closing data or entry attribution needs reconciliation. Result omitted from totals."
          : mismatch ? "Stored PnL attribution differs from this journal result. Totals use the existing journal result." : "",
      trade, tradeType: null, strategies: [], privateNotes: "", asrComments: "", description: "",
    } satisfies IdeaTrade;
  });

  // Legacy repairs created aliases one millisecond apart. Only excluded records
  // can be suppressed, and only with matching close, entry and quantity evidence.
  for (let i = 0; i < selected.length; i++) {
    const row = selected[i], c = closed[i];
    if (row.status !== "excluded") continue;
    const matches = closed.map((other, index) => ({ other, index })).filter(({ other, index }) =>
      index !== i && other.symbol === c.symbol && other.direction === c.direction &&
      Math.abs(other.openedAt.getTime() - c.openedAt.getTime()) <= 1 &&
      other.closedAt!.getTime() === c.closedAt!.getTime() &&
      Math.abs(other.entryPrice - c.entryPrice) < Math.max(1, c.entryPrice) * 1e-8 &&
      other.quantity !== undefined && other.quantity === c.quantity);
    const rank = (index: number) => (selected[index].resultR !== null ? 100 : 0) + (pnlByCycle.get(closed[index]._id)?.length ? 10 : 0);
    const winner = [{ other: c, index: i }, ...matches].sort((a, b) => rank(b.index) - rank(a.index) || selected[a.index].id.localeCompare(selected[b.index].id))[0];
    if (winner.index !== i) {
      row.duplicateOf = selected[winner.index].id;
      row.warning = "Duplicate legacy cycle. Group the canonical trade instead; this record is never counted.";
    }
  }
  return selected.sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt) || a.id.localeCompare(b.id));
}
