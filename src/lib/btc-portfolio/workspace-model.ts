import { createHash } from "node:crypto";
import { z } from "zod";
import { ledgerSchema, eventSchema, publicSchema, type PublicPortfolio } from "./schema";
import { portfolioEditorialNoteSchema } from "./stories";
import { localChartHistorySchema, combinePortfolioHistory } from "./history";
import { replayPortfolio } from "./engine";
import { applyPropResults, combineCurrentPortfolioResults } from "./prop-performance";
import { withholdWalletHistory } from "./privacy";

const at = z.iso.datetime({ offset: true });
export const portfolioDraftSchema = z.object({
  ledger: ledgerSchema,
  history: localChartHistorySchema,
  propResults: z.array(z.object({ id: z.string().min(1).max(100), openedAt: at, closedAt: at, resultR: z.number().finite() }).strict()).max(2000),
  riskFraction: z.number().positive().max(1),
  notes: z.array(z.object({ note: portfolioEditorialNoteSchema, visible: z.boolean() }).strict()).max(200),
  privateNotes: z.string().max(10000),
}).strict();
export type PortfolioDraft = z.infer<typeof portfolioDraftSchema>;
export const draftFingerprint = (draft: PortfolioDraft) => createHash("sha256").update(JSON.stringify(draft)).digest("hex");
export function calculatePortfolioDraft(input: PortfolioDraft) {
  const draft = portfolioDraftSchema.parse(input);
  if (new Set(draft.notes.map(row => row.note.id)).size !== draft.notes.length) throw new Error("Idea IDs must be unique.");
  if (draft.ledger.mode !== "reconstructed" || draft.ledger.currency !== "USD") throw new Error("The review ledger must remain a USD reconstruction.");
  if (new Set(draft.ledger.events.map(row => row.id)).size !== draft.ledger.events.length) throw new Error("Transaction IDs must be unique.");
  const replay = replayPortfolio(draft.ledger);
  let current = replay.publicData;
  if (draft.propResults.length) {
    const result = applyPropResults(current.points, draft.propResults, draft.riskFraction);
    current = combineCurrentPortfolioResults(current, { status: "approved-localhost", method: "spot-and-closed-prop-results", spotFingerprint: "0".repeat(64), inceptionAt: current.inceptionAt, asOf: current.asOf, propThrough: result.propThrough!, propTradeCount: draft.propResults.length, points: result.points });
  }
  const reduced = withholdWalletHistory(combinePortfolioHistory(current, draft.history), { walletCurveApproved: true });
  const preview = publicSchema.parse({ ...reduced, editorialNotes: draft.notes.filter(row => row.visible).map(row => row.note), privacy: { ...reduced.privacy!, publication: "staging-preview" } });
  if (!replay.checks.filter(check => check.name !== "Independent actual statements").every(check => check.passed)) throw new Error("The draft does not pass portfolio reconciliation.");
  return { preview, summary: replay.summary, checks: replay.checks, fingerprint: draftFingerprint(draft) };
}
const base = { revision: z.number().int().nonnegative(), requestId: z.uuid() };
export const workspaceCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("save-draft"), draft: portfolioDraftSchema, reason: z.string().trim().min(1).max(600) }).strict(),
  z.object({ ...base, action: z.literal("save-event"), event: eventSchema, reason: z.string().trim().min(1).max(600) }).strict(),
  z.object({ ...base, action: z.literal("save-note"), note: portfolioEditorialNoteSchema, visible: z.boolean(), reason: z.string().trim().min(1).max(600) }).strict(),
  z.object({ ...base, action: z.literal("validate"), fingerprint: z.string().length(64) }).strict(),
  z.object({ ...base, action: z.literal("publish"), fingerprint: z.string().length(64) }).strict(),
  z.object({ ...base, action: z.literal("restore"), releaseId: z.uuid() }).strict(),
]);
export type WorkspaceCommand = z.infer<typeof workspaceCommandSchema>;
export interface PortfolioWorkspace {
  _id: string; revision: number; draft: PortfolioDraft; validatedFingerprint: string | null;
  publicReleaseId: string; operations: { id: string; hash: string }[]; updatedAt: string;
}
export interface PortfolioWorkspaceSnapshot {
  revision: number; draft: PortfolioDraft; fingerprint: string; validated: boolean;
  preview: PublicPortfolio; published: PublicPortfolio; summary: ReturnType<typeof replayPortfolio>["summary"];
  checks: ReturnType<typeof replayPortfolio>["checks"];
  releases: { id: string; sequence: number; at: string }[];
  audit: { at: string; action: string; reason: string; revision: number }[];
}
export class WorkspaceConflict extends Error {}
export function prepareWorkspaceChange(current: PortfolioWorkspace, command: WorkspaceCommand) {
  const hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  const receipt = current.operations.find(row => row.id === command.requestId);
  if (receipt) { if (receipt.hash !== hash) throw new WorkspaceConflict("This request ID was already used for different changes."); return null; }
  if (current.revision !== command.revision) throw new WorkspaceConflict("Another edit was saved. Refresh status; your form is retained.");
  const next = structuredClone(current);
  if (command.action === "save-draft") next.draft = command.draft;
  if (command.action === "save-event") {
    const i = next.draft.ledger.events.findIndex(row => row.id === command.event.id);
    if (i < 0) next.draft.ledger.events.push(command.event); else next.draft.ledger.events[i] = command.event;
  }
  if (command.action === "save-note") {
    const row = { note: command.note, visible: command.visible }, i = next.draft.notes.findIndex(entry => entry.note.id === command.note.id);
    if (i < 0) next.draft.notes.push(row); else next.draft.notes[i] = row;
  }
  const calculated = calculatePortfolioDraft(next.draft);
  if (command.action === "validate" || command.action === "publish") {
    if (command.fingerprint !== calculated.fingerprint) throw new WorkspaceConflict("The draft changed after review. Review it again.");
    if (command.action === "publish" && current.validatedFingerprint !== calculated.fingerprint) throw new Error("Validate the current draft before publishing.");
    next.validatedFingerprint = calculated.fingerprint;
  } else if (command.action !== "restore") next.validatedFingerprint = null;
  next.revision++; next.updatedAt = new Date().toISOString();
  next.operations.push({ id: command.requestId, hash });
  return { next, calculated };
}
