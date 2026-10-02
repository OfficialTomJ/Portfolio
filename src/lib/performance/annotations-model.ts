import { calculateStats, equitySeries } from "./metrics";
import type { PerformanceTrade, TradeType, TradeTag } from "./types";

export interface TradeAnnotation {
  revision: number;
  tradeType: TradeType | null;
  strategyIds: string[];
  description: string;
  privateNotes: string;
  asrComments: string;
  expectedR: number | null;
  valid: boolean | null;
}

export const EMPTY_ANNOTATION: TradeAnnotation = {
  revision: 0, tradeType: null, strategyIds: [], description: "", privateNotes: "", asrComments: "", expectedR: null, valid: null,
};
export const TRADE_ID_PATTERN = /^trade-[a-f0-9]{20}$/;
export const TAG_ID_PATTERN = /^tag-[a-f0-9]{20}$/;

export function normalizeTagName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a tag name");
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!name || name.length > 40 || /[\p{Cc}\p{Cf}<>]/u.test(name)) throw new Error("Use a tag name of 1–40 characters");
  return name;
}

export function parseAnnotation(value: unknown, closed: boolean): TradeAnnotation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid edit");
  const v = value as Record<string, unknown>;
  const allowed = Object.keys(EMPTY_ANNOTATION);
  if (Object.keys(v).some((key) => !allowed.includes(key))) throw new Error("Unknown edit field");
  if (!Number.isSafeInteger(v.revision) || (v.revision as number) < 0) throw new Error("Invalid revision");
  if (v.tradeType !== null && v.tradeType !== "DAY" && v.tradeType !== "SWING") throw new Error("Choose Day, Swing, or not set");
  if (!Array.isArray(v.strategyIds) || v.strategyIds.length > 12 || v.strategyIds.some((id) => typeof id !== "string" || !TAG_ID_PATTERN.test(id))) throw new Error("Choose up to 12 strategies");
  const text = (key: string, limit: number) => {
    if (typeof v[key] !== "string" || (v[key] as string).length > limit) throw new Error(`Invalid ${key}`);
    return (v[key] as string).trim();
  };
  if (v.expectedR !== null && (typeof v.expectedR !== "number" || !Number.isFinite(v.expectedR) || Math.abs(v.expectedR) > 100)) throw new Error("Expected R must be between -100 and 100");
  if (v.valid !== null && typeof v.valid !== "boolean") throw new Error("Choose valid, invalid, or not reviewed");
  const annotation: TradeAnnotation = {
    revision: v.revision as number, tradeType: v.tradeType as TradeType | null, strategyIds: [...new Set(v.strategyIds as string[])].sort(),
    description: text("description", 5000), privateNotes: text("privateNotes", 10000),
    asrComments: text("asrComments", 10000), expectedR: v.expectedR as number | null, valid: v.valid as boolean | null,
  };
  if (!closed && (annotation.expectedR !== null || annotation.valid !== null || annotation.asrComments)) throw new Error("ASR is available after the trade closes");
  return annotation;
}

export type TradeTypeFilter = TradeType | "UNCLASSIFIED";
export function matchesTradeFilters(type: TradeType | null | undefined, strategies: string[], types: TradeTypeFilter[], selectedStrategies: string[]): boolean {
  return (!types.length || types.includes(type ?? "UNCLASSIFIED")) &&
    (!selectedStrategies.length || strategies.some((id) => selectedStrategies.includes(id)));
}

/** Unknown legacy tags become private; conflicting Day/Swing labels remain unset. */
export function classifyLegacyTags(ids: string[], catalogue: TradeTag[]) {
  const byId = new Map(catalogue.map((tag) => [tag.id, tag.name.normalize("NFKC").trim().toUpperCase()]));
  const types = new Set<TradeType>();
  const strategyIds: string[] = [];
  for (const id of [...new Set(ids)]) {
    const name = byId.get(id);
    if (name === "DAY" || name === "DAY TRADE") types.add("DAY");
    else if (name === "SWING" || name === "SWING TRADE") types.add("SWING");
    else strategyIds.push(id);
  }
  return { tradeType: types.size === 1 ? [...types][0] : null, strategyIds: strategyIds.sort(), conflict: types.size > 1 };
}

export function asrStatus(annotation?: TradeAnnotation): "Not reviewed" | "Incomplete" | "Reviewed" {
  if (annotation?.expectedR != null && annotation.valid != null) return "Reviewed";
  return annotation && (annotation.expectedR != null || annotation.valid != null || annotation.asrComments) ? "Incomplete" : "Not reviewed";
}

export function buildAsrComparison(trades: PerformanceTrade[], annotations: Record<string, TradeAnnotation>, startsAt: Date, validity: "all" | "valid" | "invalid") {
  const reviewed = trades.filter((trade) => asrStatus(annotations[trade.id]) === "Reviewed");
  const paired = reviewed.filter((trade) => validity === "all" || annotations[trade.id].valid === (validity === "valid"));
  const expected = paired.map((trade) => ({ ...trade, resultR: annotations[trade.id].expectedR! }));
  const actualStats = calculateStats(paired);
  const expectedStats = calculateStats(expected);
  return {
    actual: equitySeries(paired, startsAt), expected: equitySeries(expected, startsAt),
    actualR: actualStats.totalR, expectedR: expectedStats.totalR,
    gap: expectedStats.totalR - actualStats.totalR, pairedCount: paired.length,
    reviewedCount: reviewed.length, eligibleCount: trades.length,
    validCount: reviewed.filter((trade) => annotations[trade.id].valid).length,
    invalidCount: reviewed.filter((trade) => !annotations[trade.id].valid).length,
    incompleteCount: trades.filter((trade) => asrStatus(annotations[trade.id]) === "Incomplete").length,
  };
}
