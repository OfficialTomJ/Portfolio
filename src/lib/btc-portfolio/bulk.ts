import { eventSchema, type PortfolioEvent } from "./schema";
import { newEvent, PortfolioInputError } from "./engine";

export const importExample = "review-fill-1\t2026-11-12T13:00:00Z\tbuy\tmargin\tBTC\t0.001\t130000\t0.2\tUSDT\t\tlong\t2\tAdded gradually to the Bitcoin reserve.";
/** Stable first-column IDs make repeated/overlapping pastes idempotent. No random import IDs. */
export function parseImport(text: string): PortfolioEvent[] {
  const rows = text.trim().split(/\r?\n/).filter(r => r.trim());
  if (!text.trim() || rows.length > 200) throw new PortfolioInputError("Paste between 1 and 200 tab-separated rows.");
  return rows.map((row, index) => {
    const columns = row.split("\t");
    if (columns.length !== 13) throw new PortfolioInputError(`Row ${index + 1}: expected 13 tab-separated columns.`);
    const [source, at, kind, account, asset, quantity, price, fee, feeAsset, positionId, direction, leverage, publicReason] = columns;
    const parsed = eventSchema.safeParse({ ...newEvent(at), id: `import-${source}`, sourceId: `paste:${source}`, sequence: 5000 + index, kind, account, asset, quantity, price, fee, feeAsset, positionId, direction, leverage: Number(leverage), publicReason });
    if (!parsed.success) throw new PortfolioInputError(`Row ${index + 1}: ${parsed.error.issues[0]?.message}`);
    return parsed.data;
  });
}
