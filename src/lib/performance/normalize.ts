import type { PerformanceTrade, TradeDirection } from "./types";

export interface ClosedCycleInput {
  id: string;
  symbol: string;
  direction: TradeDirection;
  openedAt: Date;
  fallbackEntryPrice: number;
  riskAmount?: number;
}

export interface ClosedPnlSlice {
  avgEntryPrice: string | number;
  avgExitPrice: string | number;
  closedSize: string | number;
  qty: string | number;
  closedPnl: string | number;
  updatedTime: string | number;
}

export type NormalizeClosedCycleResult =
  | { ok: true; trade: PerformanceTrade }
  | { ok: false; reason: "missing_risk" | "invalid_risk" | "invalid_close" };

function finiteNumber(value: string | number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sliceQuantity(record: ClosedPnlSlice): number {
  return finiteNumber(record.closedSize) || finiteNumber(record.qty);
}

function weightedAverage(
  records: ClosedPnlSlice[],
  field: "avgEntryPrice" | "avgExitPrice"
): number {
  const quantity = records.reduce((total, item) => total + sliceQuantity(item), 0);
  if (quantity <= 0) return 0;
  return records.reduce(
    (total, item) => total + finiteNumber(item[field]) * sliceQuantity(item),
    0
  ) / quantity;
}

export function normalizeClosedCycle(
  cycle: ClosedCycleInput,
  records: ClosedPnlSlice[]
): NormalizeClosedCycleResult {
  if (cycle.riskAmount === undefined) return { ok: false, reason: "missing_risk" };

  const quantity = records.reduce((total, item) => total + sliceQuantity(item), 0);
  const entryPrice = weightedAverage(records, "avgEntryPrice") || cycle.fallbackEntryPrice;
  const exitPrice = weightedAverage(records, "avgExitPrice");
  const initialRisk = finiteNumber(cycle.riskAmount);

  if (initialRisk <= 0) return { ok: false, reason: "invalid_risk" };
  if (!records.length || quantity <= 0 || exitPrice <= 0) {
    return { ok: false, reason: "invalid_close" };
  }

  const netClosedPnl = records.reduce(
    (total, item) => total + finiteNumber(item.closedPnl),
    0
  );
  const closedAtMs = records.reduce(
    (latest, item) => Math.max(latest, finiteNumber(item.updatedTime)),
    cycle.openedAt.getTime()
  );

  return {
    ok: true,
    trade: {
      id: cycle.id,
      symbol: cycle.symbol,
      direction: cycle.direction,
      openedAt: cycle.openedAt.toISOString(),
      closedAt: new Date(closedAtMs).toISOString(),
      entryPrice,
      exitPrice,
      resultR: netClosedPnl / initialRisk,
    },
  };
}
