import { z } from "zod";
import type { PerformanceTrade, TradeDirection } from "./types";

export interface TradeIdea {
  id: string;
  name: string;
  thesis: string;
  target: string;
  invalidation: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaGroups {
  revision: number;
  ideas: TradeIdea[];
  assignments: Record<string, string>;
}

export interface IdeaTrade {
  id: string;
  symbol: string;
  direction: TradeDirection;
  openedAt: string;
  closedAt: string;
  resultR: number | null;
  status: string;
  exception: boolean;
  duplicateOf: string | null;
  warning: string;
  trade: PerformanceTrade | null;
  tradeType: string | null;
  strategies: string[];
  privateNotes: string;
  asrComments: string;
  description: string;
}

export interface IdeasSnapshot extends IdeaGroups {
  trades: IdeaTrade[];
  lastSyncAt: string;
  environment: string;
}

const ideaId = z.string().regex(/^idea-[a-f0-9-]{36}$/);
const tradeId = z.string().regex(/^trade-[a-f0-9]{20}$/);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const ideaFieldsSchema = z.object({
  name: z.string().trim().min(1, "Enter an idea name").max(120),
  thesis: z.string().trim().max(5000),
  target: z.string().trim().max(1000),
  invalidation: z.string().trim().max(1000),
  notes: z.string().trim().max(10000),
}).strict();
const tradeIds = z.array(tradeId).max(200).refine(ids => new Set(ids).size === ids.length, "Select each trade only once");
export const ideaMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), revision, fields: ideaFieldsSchema, tradeIds }).strict(),
  z.object({ action: z.literal("update"), revision, ideaId, fields: ideaFieldsSchema }).strict(),
  z.object({ action: z.literal("assign"), revision, ideaId: ideaId.nullable(), tradeIds: tradeIds.refine(ids => ids.length > 0, "Select at least one trade") }).strict(),
  z.object({ action: z.literal("delete"), revision, ideaId }).strict(),
]);
export type IdeaFields = z.infer<typeof ideaFieldsSchema>;
export type IdeaMutation = z.infer<typeof ideaMutationSchema>;
export const EMPTY_IDEA_FIELDS: IdeaFields = { name: "", thesis: "", target: "", invalidation: "", notes: "" };

/** A trade cycle is counted once. Unknown/excluded results never become zeroes. */
export function summariseIdea(trades: IdeaTrade[]) {
  const unique = [...new Map(trades.filter(t => !t.duplicateOf).map(t => [t.id, t])).values()];
  const timeline = unique.sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt) || a.id.localeCompare(b.id));
  const known = timeline.filter(t => t.resultR !== null);
  const grossWins = known.reduce((sum, t) => sum + Math.max(0, t.resultR!), 0);
  const grossLosses = known.reduce((sum, t) => sum + Math.min(0, t.resultR!), 0);
  let cumulativeR = 0;
  return {
    count: unique.length,
    knownCount: known.length,
    unknownCount: unique.length - known.length,
    warningCount: unique.filter(t => t.warning).length,
    netR: known.length ? grossWins + grossLosses : null,
    grossWins, grossLosses,
    winners: known.filter(t => t.resultR! > 0).length,
    losers: known.filter(t => t.resultR! < 0).length,
    firstEntry: unique.length ? [...unique].sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt))[0].openedAt : null,
    lastExit: timeline.at(-1)?.closedAt ?? null,
    timeline: timeline.map(t => {
      if (t.resultR !== null) cumulativeR += t.resultR;
      return { ...t, cumulativeR: t.resultR === null ? null : cumulativeR };
    }),
  };
}

/** Optional private idea edit submitted with a trade review. */
export const tradeIdeaEditSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), revision, ideaId: ideaId.nullable() }).strict(),
  z.object({ action: z.literal("create"), revision, fields: ideaFieldsSchema }).strict(),
]);
export type TradeIdeaEdit = z.infer<typeof tradeIdeaEditSchema>;
export interface IdeaEditorData extends IdeaGroups { eligible: boolean }
