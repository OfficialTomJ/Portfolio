import { createHash } from "node:crypto";

/** A deterministic ID keeps journal eligibility tied to the same position
 * cycle, including when ingestion has already written a public document. */
export function publicTradeIdForCycle(cycleId: string): string {
  return `trade-${createHash("sha256").update(cycleId).digest("hex").slice(0, 20)}`;
}

export function excludedTradeIds(cycles: Array<{ _id: string }>): Set<string> {
  return new Set(cycles.map((cycle) => publicTradeIdForCycle(cycle._id)));
}
