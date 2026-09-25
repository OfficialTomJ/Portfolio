import { createHash } from "node:crypto";

/** The public ID is deterministic so an exception can hide a trade even if a
 * prior sync wrote its public document before marking the cycle complete. */
export function publicTradeIdForCycle(cycleId: string): string {
  return `trade-${createHash("sha256").update(cycleId).digest("hex").slice(0, 20)}`;
}

export function excludedTradeIds(cycles: Array<{ _id: string }>): Set<string> {
  return new Set(cycles.map((cycle) => publicTradeIdForCycle(cycle._id)));
}
