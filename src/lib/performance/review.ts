import { createHash } from "node:crypto";
import type { BybitClosedPnl } from "./bybit";
import type { PerformanceTrade } from "./types";

export function performanceReviewFingerprint(
  trade: PerformanceTrade,
  records: BybitClosedPnl[],
  riskVersionId: string | undefined,
  riskAmount: number | undefined
): string {
  const source = records.map((record) => ({
    orderId: record.orderId,
    symbol: record.symbol,
    side: record.side,
    qty: record.qty,
    closedSize: record.closedSize,
    avgEntryPrice: record.avgEntryPrice,
    avgExitPrice: record.avgExitPrice,
    closedPnl: record.closedPnl,
    openFee: record.openFee,
    closeFee: record.closeFee,
    execType: record.execType,
    createdTime: record.createdTime,
    updatedTime: record.updatedTime,
  })).sort((a, b) => `${a.orderId}:${a.updatedTime}`.localeCompare(`${b.orderId}:${b.updatedTime}`));

  return createHash("sha256")
    .update(JSON.stringify({ trade: {
      id: trade.id, symbol: trade.symbol, direction: trade.direction,
      openedAt: trade.openedAt, closedAt: trade.closedAt,
      entryPrice: trade.entryPrice, exitPrice: trade.exitPrice, resultR: trade.resultR,
    }, source, riskVersionId, riskAmount }))
    .digest("hex");
}

export function mayPublishReviewedTrade(input: {
  alreadyPublished: boolean;
  active: boolean;
  excluded: boolean;
  held: boolean;
  candidateFingerprint: string;
  approvedFingerprint?: string;
}): boolean {
  return !input.active && !input.excluded && !input.held && (
    input.alreadyPublished || input.approvedFingerprint === input.candidateFingerprint
  );
}
