import { breakoutConflicts, type BreakoutFile, type BreakoutRecord, type BreakoutRow } from "./breakout";
import type { PerformanceTrade } from "./types";

export type ImportRowStatus = "new" | "reconciliation" | "duplicate";
export interface ImportPreviewRow {
  key: string; line: number; instrument: string; trade: PerformanceTrade;
  status: ImportRowStatus; reason: string;
}
export interface ImportPreview {
  fileSha256: string; revision: number; rows: ImportPreviewRow[];
  clean: number; reconciliation: number; duplicates: number; affectedPending: number;
}

/** Include all observed evidence, even positions left unchecked in a prior import. */
export function conflictEvidence(rows: BreakoutRow[]): Set<string> {
  const unique = [...new Map(rows.map(row => [row.key, row])).values()];
  const held = breakoutConflicts(unique);
  const identities = new Map<string, string>();
  for (const row of unique) {
    const key = identities.get(row.identity);
    if (key && key !== row.key) { held.add(key); held.add(row.key); }
    identities.set(row.identity, row.key);
  }
  return held;
}

export function planBreakoutImport(file: BreakoutFile, existing: BreakoutRecord[], evidence: BreakoutRow[] = []) {
  const known = new Map(existing.map(row => [row.key, row]));
  const all = [...new Map([...evidence, ...existing, ...file.rows].map(row => [row.key, row])).values()];
  const held = conflictEvidence(all);
  const rows: ImportPreviewRow[] = file.rows.map(row => {
    const prior = known.get(row.key);
    const status = prior ? "duplicate" : held.has(row.key) ? "reconciliation" : "new";
    const reason = prior ? prior.status === "reconciliation" || held.has(row.key) ? "Already imported; requires reconciliation." : "Already imported; no duplicate will be added."
      : status === "reconciliation" ? "Overlapping positions or possible source correction. Agent reconciliation required; no grouping was inferred."
        : "Clean position; ready for private review after import.";
    return { key: row.key, line: row.line, instrument: row.values.instrument, trade: row.trade, status, reason };
  });
  return { all, held, rows, affectedPending: existing.filter(row => held.has(row.key) && row.status === "pending_review").length };
}
