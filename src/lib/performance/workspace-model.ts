import { z } from "zod";
import type { PerformanceTrade, TradeTag } from "./types";
import type { TradeAnnotation } from "./annotations-model";
import type { IdeaGroups } from "./ideas-model";
import { ideaChartSchema, ideaUpdateSchema, type IdeaChart, type IdeaUpdate, type PublishedIdeaUpdate } from "./idea-timeline-model";

const nullablePositive = z.number().finite().positive().nullable();
const instant = z.string().datetime({ offset: true }).refine(v => Number.isFinite(Date.parse(v)) && Date.parse(v) <= Date.now()+300000, "Enter a valid, non-future time with a timezone");
export const factsSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9]{3,30}$/, "Use a symbol such as BTCUSDT"), direction: z.enum(["Long", "Short"]),
  openedAt: instant, closedAt: instant.nullable(), entryPrice: nullablePositive, exitPrice: nullablePositive,
  resultR: z.number().finite().min(-100).max(100).nullable(),
}).strict().refine(v => !v.closedAt || Date.parse(v.closedAt) >= Date.parse(v.openedAt), "Exit cannot precede entry");
export const editSchema = z.object({
  facts: factsSchema, inclusion: z.enum(["included", "held", "excluded"]), reason: z.string().trim().min(3, "Add a reconciliation reason").max(2000),
  resultMode: z.enum(["source", "manual"]), riskR: z.number().finite().positive().max(100),
  stopPrice: nullablePositive, quantity: nullablePositive, fees: z.number().finite().nonnegative().nullable(),
  netPnl: z.number().finite().nullable(), riskBasis: nullablePositive,
  tradeType: z.enum(["DAY", "SWING"]).nullable(), description: z.string().trim().max(5000),
  strategyIds: z.array(z.string().regex(/^tag-[a-f0-9]{20}$/)).max(12),
  privateNotes: z.string().max(10000), asrComments: z.string().max(10000), expectedR: z.number().finite().min(-100).max(100).nullable(), valid: z.boolean().nullable(),
  ideaId: z.string().regex(/^idea-[a-f0-9-]{36}$/).nullable(), resolveHold: z.boolean(),
}).strict().superRefine((v, ctx) => {
  if (v.inclusion === "included" && !completeFacts(v.facts)) ctx.addIssue({ code: "custom", message: "Complete entry, exit and actual R before including a trade" });
  if (v.resultMode === "source" && v.netPnl !== null && v.riskBasis !== null && Math.abs(v.netPnl / v.riskBasis - (v.facts.resultR ?? Infinity)) > 1e-8)
    ctx.addIssue({ code: "custom", message: "Source result must equal net PnL divided by its original R basis" });
});
export type TradeFacts = z.infer<typeof factsSchema>;
export type TradeEdit = z.infer<typeof editSchema>;
export function completeFacts(f: TradeFacts): boolean { return f.closedAt !== null && f.entryPrice !== null && f.exitPrice !== null && f.resultR !== null; }
export function publicFacts(id: string, source: PerformanceTrade["source"], edit: TradeEdit): PerformanceTrade {
  if (!completeFacts(edit.facts)) throw new Error("Complete trade facts before publication");
  return { id, source, symbol: edit.facts.symbol, direction: edit.facts.direction, openedAt: edit.facts.openedAt,
    closedAt: edit.facts.closedAt!, entryPrice: edit.facts.entryPrice!, exitPrice: edit.facts.exitPrice!, resultR: edit.facts.resultR!, tradeType: edit.tradeType, description: edit.description };
}
export interface WorkspaceSource {
  id: string; source: "bybit" | "breakout"; facts: TradeFacts; scope: string; status: string;
  archived: boolean; duplicateOf: string | null; held: boolean; warning: string; sourceFingerprint: string;
  privateExecution: { quantity: number | null; fees: number | null; netPnl: number | null; riskBasis: number | null; stopPrice: number | null };
  evidence: unknown;
}
export interface WorkspaceRow extends WorkspaceSource { revision: number; asrRevision?: number; asrStale?: boolean; edit: TradeEdit; published: PerformanceTrade | null; publishedInclusion: string | null; publishedRevision: number | null; publishedIdeaId:string|null; sourceChanged:boolean; dirty: boolean }
export interface PublicIdeaFields { title: string; thesis: string; target: string; invalidation: string; status: "active" | "completed" | "invalidated"; ideaAt: string; articleUrl: string; chart?: IdeaChart; updates?: IdeaUpdate[] }
export const publicIdeaSchema = z.object({ title: z.string().trim().min(1).max(120), thesis: z.string().trim().min(1).max(5000), target: z.string().trim().max(1000),
  invalidation: z.string().trim().max(1000), status: z.enum(["active", "completed", "invalidated"]), ideaAt: instant,
  articleUrl: z.union([z.literal(""), z.string().url().max(1000).refine(v => new URL(v).protocol === "https:", "Use an HTTPS article URL")]),
  chart: ideaChartSchema.optional(), updates: z.array(ideaUpdateSchema).max(24).optional(),
}).strict().superRefine((v,ctx) => {
  const seen = new Set<string>();
  for (const update of v.updates ?? []) {
    if (seen.has(update.id)) ctx.addIssue({code:"custom",message:"Timeline updates must have unique IDs"});
    if (Date.parse(update.at) < Date.parse(v.ideaAt)) ctx.addIssue({code:"custom",message:"Timeline updates cannot precede the idea date"});
    seen.add(update.id);
  }
});
export interface IdeaDraft { id: string; revision: number; fields: PublicIdeaFields; published: boolean; publishedRevision: number | null; firstPublishedAt?:string; tradeIds?:string[] }
export interface PublicIdea extends PublicIdeaFields { id: string; firstPublishedAt: string; updatedAt: string; tradeIds: string[]; updates?: PublishedIdeaUpdate[] }
export interface WorkspaceHistory { id: string; tradeId: string; action: string; revision: number; at: string; reason: string }
export interface WorkspaceSnapshot { rows: WorkspaceRow[]; ideas: IdeaGroups; tags:TradeTag[]; ideaDrafts: IdeaDraft[]; history: WorkspaceHistory[]; asOf: string }
export function initialEdit(source: WorkspaceSource, annotation: TradeAnnotation, ideaId: string | null): TradeEdit {
  return { facts: source.facts, inclusion: source.held || source.archived ? "held" : "included", reason: "", resultMode: "source", ...source.privateExecution,
    riskR: annotation.riskR, tradeType: annotation.tradeType, strategyIds: annotation.strategyIds, description: annotation.description,
    privateNotes: annotation.privateNotes, asrComments: annotation.asrComments, expectedR: annotation.expectedR, valid: annotation.valid, ideaId, resolveHold: false };
}
