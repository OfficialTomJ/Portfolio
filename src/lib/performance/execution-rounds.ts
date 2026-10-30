import type { BybitClosedPnl, BybitExecution } from "./bybit";

export interface ClosedExecutionRound {
  symbol: string;
  direction: "Long" | "Short";
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  quantity: number;
  openingOrderIds: string[];
  closingOrderIds: string[];
  closingQuantity: number;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));

/** Complete, one-way, flat-to-flat positions only. Never infer a missing prefix. */
export function reconstructClosedRounds(executions: BybitExecution[]) {
  const streams = new Map<string, BybitExecution[]>();
  for (const e of executions) {
    if (e.execType !== "Trade") continue;
    const stream = streams.get(e.symbol) ?? [];
    stream.push(e); streams.set(e.symbol, stream);
  }
  const rounds: ClosedExecutionRound[] = [];
  const issues: string[] = [];
  for (const [symbol, stream] of streams) {
    stream.sort((a, b) => Number(a.execTime) - Number(b.execTime) || a.seq - b.seq || a.execId.localeCompare(b.execId));
    let balance = 0;
    let round: ClosedExecutionRound | null = null;
    let entryValue = 0;
    const seen = new Set<string>();
    for (const e of stream) {
      if (seen.has(e.execId)) continue;
      seen.add(e.execId);
      const qty = Number(e.execQty), closed = Number(e.closedSize), price = Number(e.execPrice), time = Number(e.execTime);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(closed) || closed < 0 || closed > qty ||
        !Number.isFinite(price) || price <= 0 || !Number.isFinite(time) || time <= 0 || !["Buy", "Sell"].includes(e.side)) {
        issues.push(`${symbol}: invalid execution; remaining history needs reconciliation`); break;
      }
      if (!round) {
        if (closed !== 0) { issues.push(`${symbol}: opening fills are missing`); break; }
        round = { symbol, direction: e.side === "Buy" ? "Long" : "Short", openedAt: new Date(time), closedAt: new Date(time), entryPrice: 0,
          quantity: 0, openingOrderIds: [], closingOrderIds: [], closingQuantity: 0 };
        entryValue = 0;
      }
      const openingSide = round.direction === "Long" ? "Buy" : "Sell";
      if (e.side === openingSide) {
        if (closed !== 0) { issues.push(`${symbol}: inconsistent closing side`); break; }
        balance += qty; round.quantity += qty; entryValue += qty * price;
        if (!round.openingOrderIds.includes(e.orderId)) round.openingOrderIds.push(e.orderId);
      } else {
        if (!near(closed, qty) || (qty > balance && !near(qty, balance))) {
          issues.push(`${symbol}: missing fills, hedge mode or reversal needs reconciliation`); break;
        }
        balance -= qty; round.closingQuantity += qty; round.closedAt = new Date(time);
        if (!round.closingOrderIds.includes(e.orderId)) round.closingOrderIds.push(e.orderId);
      }
      if (e.side !== openingSide && near(balance, 0)) {
        round.entryPrice = entryValue / round.quantity;
        rounds.push(round); round = null; balance = 0;
      }
    }
  }
  return { rounds, issues };
}

/** Require every closing order and the full closed quantity before backfilling. */
export function closedPnlForRound<T extends BybitClosedPnl>(round: ClosedExecutionRound, pnl: T[]): T[] | null {
  if (!round.closingOrderIds.length || round.closingQuantity <= 0) return null;
  const records = pnl.filter(p => p.execType === "Trade" && p.symbol === round.symbol &&
    p.side === (round.direction === "Long" ? "Sell" : "Buy") && round.closingOrderIds.includes(p.orderId));
  if (records.length !== round.closingOrderIds.length || new Set(records.map(r => r.orderId)).size !== records.length ||
    !records.every(r => String(r.closedPnl).trim() !== "" && Number.isFinite(Number(r.closedPnl)) && Number(r.closedSize || r.qty) > 0 &&
      Number(r.updatedTime) >= round.openedAt.getTime() && Number(r.updatedTime) <= round.closedAt.getTime() + 1000) ||
    !near(records.reduce((sum, r) => sum + Number(r.closedSize || r.qty), 0), round.closingQuantity)) return null;
  return records;
}

export interface ExecutionCycleMatch {
  _id: string; symbol: string; direction: string; openedAt: Date;
  excludedFromJournal?: boolean; exclusionReason?: string; status: string;
}

/** Keep stable journal IDs; legacy aliases may differ from the first fill by 1ms. */
export function matchExecutionCycle<T extends ExecutionCycleMatch>(round: ClosedExecutionRound, cycles: T[]): T | undefined {
  const matches = cycles.filter(c => c.symbol === round.symbol && c.direction === round.direction &&
    Math.abs(c.openedAt.getTime() - round.openedAt.getTime()) <= 1);
  const canonical = matches.filter(c => !c.excludedFromJournal && c.status !== "excluded");
  if (canonical.length > 1) throw new Error(`${round.symbol}: ambiguous canonical cycles require reconciliation`);
  return canonical[0] ?? matches.find(c => c.exclusionReason === "user_request") ?? matches[0];
}
