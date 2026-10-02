import { asrStatus, type TradeAnnotation } from "./annotations-model";
import type { PerformanceTrade } from "./types";

export type ReviewTab = "needs_asr" | "reviewed" | "all" | "active";
export type PublicationFilter = "all" | "pending" | "published";

/** Publication and ASR are independent. Incomplete drafts still need ASR. */
export function filterReviewTrades(trades: PerformanceTrade[], annotations: Record<string, TradeAnnotation>, pendingIds: Set<string>, tab: ReviewTab, publication: PublicationFilter, search = "") {
  if (tab === "active") return [];
  const query = search.trim().toLowerCase();
  return trades.filter(trade => {
    const reviewed = asrStatus(annotations[trade.id]) === "Reviewed";
    return (tab === "all" || (tab === "reviewed" ? reviewed : !reviewed)) &&
      (publication === "all" || pendingIds.has(trade.id) === (publication === "pending")) &&
      trade.symbol.toLowerCase().includes(query);
  });
}

/** Account-scoped closed trades only. No publication side effects or active results. */
export function nextUnreviewedTradeId(currentId: string, trades: PerformanceTrade[], annotations: Record<string, TradeAnnotation>): string | null {
  return [...trades].sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt) || a.id.localeCompare(b.id))
    .find(trade => trade.id !== currentId && asrStatus(annotations[trade.id]) !== "Reviewed")?.id ?? null;
}
