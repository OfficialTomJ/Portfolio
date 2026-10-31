import type { PerformanceTrade } from "./types";
import type { PublicIdea } from "./workspace-model";

export interface PublicIdeaView extends PublicIdea { trades: PerformanceTrade[] }

/** Group only the already filtered public record, so calendar and period totals agree. */
export function groupPublicRecord(ideas: PublicIdeaView[], trades: PerformanceTrade[], daySelected = false) {
  const ownerByTrade = new Map<string, string>();
  for (const idea of ideas) for (const trade of idea.trades) {
    if (!ownerByTrade.has(trade.id)) ownerByTrade.set(trade.id, idea.id);
  }
  const groups = ideas.map(idea => ({
    idea,
    trades: trades.filter(trade => ownerByTrade.get(trade.id) === idea.id),
  })).filter(group => group.trades.length || (!daySelected && !group.idea.trades.length))
    .sort((a, b) => Date.parse(b.idea.ideaAt) - Date.parse(a.idea.ideaAt));
  const ungrouped = trades.filter(trade => !ownerByTrade.has(trade.id));
  return { groups, ungrouped };
}

export function ideaExcerpt(text: string, maxLength = 170): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength).trimEnd()}…` : singleLine;
}
