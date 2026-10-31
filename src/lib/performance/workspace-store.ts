import "server-only";
import { createHash } from "node:crypto";
import type { ClientSession } from "mongodb";
import { z } from "zod";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { getTagCatalogue, getTradeAnnotations } from "./annotations";
import { EMPTY_ANNOTATION } from "./annotations-model";
import { getIdeasContext } from "./ideas-data";
import { publicTradeIdForCycle } from "./publication";
import { activeBreakoutHistoryFrom, BREAKOUT_ACCOUNT_ID, BREAKOUT_BASE_R, isLegacyHistory, type BreakoutAccount, type BreakoutRecord } from "./breakout";
import { BREAKOUT_COLLECTIONS, type ImportEvidence } from "./breakout-store";
import type { StoredLegacyCycle } from "./journal";
import type { PerformanceTrade } from "./types";
import { METADATA_COLLECTION, type PublicMetadataDocument } from "./public-metadata";
import { editSchema, initialEdit, publicFacts, publicIdeaSchema, ideaDraftSchema, type TradeEdit, type WorkspaceSource, type WorkspaceRow, type WorkspaceSnapshot, type IdeaDraft, type PublicIdea } from "./workspace-model";
import { asrSchema, type AsrDocument } from "./asr-model";
import { IdeaConflictError } from "./ideas-repository";
import { selectIdeaTrades } from "./ideas-selection";
import { PUBLIC_EDITS, PUBLIC_IDEAS, PUBLIC_ASSIGNMENTS, type PublicAssignment, type PublicEditDocument } from "./workspace-public";

export const EDITS = "performance_private_reconciliations";
export const HISTORY = "performance_private_reconciliation_history";
export const ASR_REVIEWS = "performance_private_asr_reviews";
export const IDEA_DRAFTS = "performance_private_idea_publication_drafts";
interface EditDocument { _id: string; revision: number; edit: TradeEdit; sourceFingerprint: string; original: WorkspaceSource; updatedAt: string }
interface HistoryDocument { _id: string; actor: string; commandHash: string; tradeId: string; action: string; revision: number; at: string; reason: string; before: unknown; after: unknown }
export class WorkspaceConflict extends Error {}
export class WorkspaceInput extends Error {}
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const number = (v: unknown) => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
const date = (v: unknown) => v instanceof Date && Number.isFinite(v.getTime()) ? v.toISOString() : typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;

async function sources(session?: ClientSession): Promise<{ rows: WorkspaceSource[]; account: BreakoutAccount | null; published: PerformanceTrade[] }> {
  const db = getDb(), options = session ? { session } : {};
  const account = await db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).findOne({ _id: BREAKOUT_ACCOUNT_ID }, options);
  const imported = await db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows).find({ accountId: BREAKOUT_ACCOUNT_ID }, options).limit(20001).toArray();
  const evidence = await db.collection<ImportEvidence>(BREAKOUT_COLLECTIONS.evidence).find({ accountId: BREAKOUT_ACCOUNT_ID }, options).limit(20001).toArray();
  const environment = process.env.BYBIT_ENV ?? "demo";
  const state = await db.collection<{ _id: string; lastRunId: string }>("performance_private_sync_state").findOne({ _id: environment }, options);
  const run = state ? await db.collection<{ _id: string; sourceAccountId: string }>("performance_private_sync_runs").findOne({ _id: state.lastRunId, status: "succeeded", environment }, options) : null;
  const cycles = run ? await db.collection<StoredLegacyCycle & { quantity?: number; initialStopPrice?: number; reconstructedCycleAliasOf?: string }>("performance_private_position_cycles").find({ environment, sourceAccountId: run.sourceAccountId }, options).limit(20001).toArray() : [];
  const published = await db.collection<PerformanceTrade & { _id: string }>("performance_published_trades").find({}, options).limit(20001).toArray();
  if ([imported, evidence, cycles, published].some(r => r.length > 20000)) throw new WorkspaceInput("History exceeds the workspace limit. Request a larger history review.");
  const byId = new Map(published.map(t => [t.id, t]));
  const duplicates = new Map(selectIdeaTrades(cycles,published,[]).filter(t=>t.duplicateOf).map(t=>[t.id,t.duplicateOf]));
  const rows = new Map<string, WorkspaceSource>();
  for (const c of cycles) {
    const id = publicTradeIdForCycle(c._id), pub = byId.get(id), base = c.reviewCandidate ?? pub;
    const openedAt = base?.openedAt ?? date(c.openedAt);
    if (!openedAt) continue;
    const facts = { symbol: base?.symbol ?? c.symbol, direction: base?.direction ?? c.direction, openedAt,
      closedAt: base?.closedAt ?? date(c.closedAt), entryPrice: number(base?.entryPrice ?? c.entryPrice), exitPrice: number(base?.exitPrice), resultR: number(base?.resultR) };
    const archived = !!account && (!facts.closedAt || !isLegacyHistory({ openedAt, closedAt: facts.closedAt }, account));
    rows.set(id, { id, source: "bybit", facts, scope: `${environment}:${c.sourceAccountId}`, status: c.status, archived,
      duplicateOf: c.reconstructedCycleAliasOf ? publicTradeIdForCycle(c.reconstructedCycleAliasOf) : duplicates.get(id) ?? null,
      held: !!c.publicationHold || !!c.excludedFromJournal || !["pending_review", "published"].includes(c.status),
      warning: archived ? "Archived Bybit history: covered by the Breakout source period." : c.publicationHold ? "Historical entry attribution requires an explicit reconciliation decision." : c.excludedFromJournal ? "Previously excluded. Restore only after reviewing the original record." : "",
      sourceFingerprint: hash(c), evidence:c, privateExecution: { quantity: number(c.quantity), fees: null, netPnl: null, riskBasis: number(c.riskAmount), stopPrice: number(c.initialStopPrice) } });
  }
  for (const pub of published) if (pub.source !== "breakout" && !rows.has(pub.id)) {
    const facts = { symbol: pub.symbol, direction: pub.direction, openedAt: pub.openedAt, closedAt: pub.closedAt, entryPrice: pub.entryPrice, exitPrice: pub.exitPrice, resultR: pub.resultR };
    rows.set(pub.id, { id: pub.id, source: "bybit", facts, scope: "legacy-published", status: "published", archived: !!account && !isLegacyHistory(pub, account), duplicateOf: null, held: false,
      warning: "Original execution details may be unavailable. Existing published facts are preserved.", sourceFingerprint: hash(pub), evidence:pub, privateExecution: { quantity: null, fees: null, netPnl: null, riskBasis: null, stopPrice: null } });
  }
  for (const row of imported) {
    const conflicts = [...imported, ...evidence].filter(other => other.values.instrument === row.values.instrument && other.values.side === row.values.side && other.values.entry_time <= row.values.exit_time && other.values.exit_time >= row.values.entry_time);
    const { id: _id, source: _source, ...facts } = row.trade; void _id; void _source;
    rows.set(row.trade.id, { id: row.trade.id, source: "breakout", facts: { symbol: facts.symbol, direction: facts.direction, openedAt: facts.openedAt, closedAt: facts.closedAt, entryPrice: facts.entryPrice, exitPrice: facts.exitPrice, resultR: facts.resultR }, scope: `breakout:${row.accountId}`,
      status: row.status, archived: false, duplicateOf: null, held: row.status === "reconciliation", warning: row.reason ?? "",
      sourceFingerprint: hash({ key: row.key, values: row.values, conflicts: conflicts.map(c => c.key).sort(), boundary: activeBreakoutHistoryFrom(account) }),
      evidence:[...new Map([row,...conflicts].map(r=>[r.key,{key:r.key,line:r.line,values:r.original??r.values}])).values()],
      privateExecution: { quantity: number(row.values.quantity), fees: number(row.values.fees), netPnl: number(row.values.net_pnl), riskBasis: Number(BREAKOUT_BASE_R), stopPrice: null } });
  }
  return { rows: [...rows.values()].sort((a,b) => (b.facts.closedAt ?? b.facts.openedAt).localeCompare(a.facts.closedAt ?? a.facts.openedAt)), account, published };
}

export async function getWorkspace(): Promise<WorkspaceSnapshot> {
  const db = getDb();
  const [catalogue, edits, publications, context, ideaDocs, history, asrDocs] = await Promise.all([
    sources(), db.collection<EditDocument>(EDITS).find({}).toArray(), db.collection<PublicEditDocument>(PUBLIC_EDITS).find({}).toArray(), getIdeasContext(),
    db.collection<IdeaDraft & { _id: string }>(IDEA_DRAFTS).find({}).toArray(), db.collection<HistoryDocument>(HISTORY).find({}).sort({ at: -1 }).limit(100).toArray(), db.collection<AsrDocument>(ASR_REVIEWS).find({}).toArray(),
  ]);
  const ideas = context ? await context.repository.load() : { revision: 0, ideas: [], assignments: {} };
  const annotations = await getTradeAnnotations(catalogue.rows.map(r => r.id));
  const metadata = await db.collection<PublicMetadataDocument>(METADATA_COLLECTION).find({}).toArray(), meta = new Map(metadata.map(m => [m._id, m]));
  const byEdit = new Map(edits.map(d => [d._id, d])), byPub = new Map(publications.map(d => [d._id, d]));
  const assignments = await db.collection<PublicAssignment>(PUBLIC_ASSIGNMENTS).find({}).toArray();
  const publishedAssignments=new Map(assignments.map(a=>[a._id,a.ideaId]));
  const byAsr = new Map(asrDocs.map(d => [d._id, d]));
  const rows: WorkspaceRow[] = catalogue.rows.map(source => {
    const stored = byEdit.get(source.id), published = byPub.get(source.id), old = catalogue.published.find(t => t.id === source.id);
    const sourceChanged=!!stored&&stored.sourceFingerprint!==source.sourceFingerprint;
    const baseEdit = stored?.edit ?? initialEdit(source, annotations[source.id] ?? EMPTY_ANNOTATION, ideas.assignments[source.id] ?? null);
    const asr = byAsr.get(source.id);
    const savedEdit = asr ? {...baseEdit, ...asr.fields} : baseEdit;
    const edit:TradeEdit = sourceChanged ? {...savedEdit,inclusion:savedEdit.inclusion==="included"?"held":savedEdit.inclusion,resolveHold:false} : savedEdit;
    return { ...source, revision: stored?.revision ?? 0, asrRevision:asr?.revision ?? 0, asrStale:!!asr&&(sourceChanged||asr.basisFingerprint!==hash({facts:baseEdit.facts,riskR:baseEdit.riskR})), edit, published: published ? published.trade : old ? { ...old, tradeType: meta.get(source.id)?.tradeType ?? null, description: meta.get(source.id)?.description ?? "" } : null,
      publishedInclusion: published?.inclusion ?? (old ? "included" : null), publishedRevision: published?.revision ?? null,
      publishedIdeaId:publishedAssignments.has(source.id)?publishedAssignments.get(source.id)!:published?.ideaId??null,
      sourceChanged, dirty: sourceChanged || !!stored && published?.revision !== stored.revision };
  });
  return { rows, ideas, tags:await getTagCatalogue(), ideaDrafts: ideaDocs.map(d => ({ id:d.id, revision:d.revision, fields:d.fields, published:d.published, publishedRevision:d.publishedRevision, firstPublishedAt:d.firstPublishedAt, tradeIds:d.tradeIds })),
    history: history.map(h => ({ id: h._id, tradeId:h.tradeId, action:h.action, revision:h.revision, at:h.at, reason:h.reason })), asOf: new Date().toISOString() };
}

const common = { requestId: z.string().uuid(), revision: z.number().int().nonnegative(), id: z.string().regex(/^trade-[a-f0-9]{20}$/) };
const commandSchema = z.discriminatedUnion("action", [
  z.object({ ...common, action:z.literal("save"), sourceFingerprint:z.string().regex(/^[a-f0-9]{64}$/), edit:editSchema }).strict(),
  z.object({ ...common, action:z.literal("publish") }).strict(),
  z.object({ ...common, action:z.literal("save-asr"), fields:asrSchema }).strict(),
  z.object({ ...common, action:z.literal("restore"), historyId:z.string().uuid() }).strict(),
  z.object({ action:z.enum(["save-idea", "publish-idea", "unpublish-idea"]), id:z.string().regex(/^idea-[a-f0-9-]{36}$/), requestId:common.requestId, revision:common.revision, fields:ideaDraftSchema.optional() }).strict(),
]);
export async function mutateWorkspace(value: unknown, actor: string) {
  const parsed = commandSchema.safeParse(value);
  if (!parsed.success) throw new WorkspaceInput(parsed.error.issues[0]?.message ?? "Invalid edit");
  const cmd = parsed.data, db = getDb(), context = await getIdeasContext();
  const ideas = context ? await context.repository.load() : { revision:0, ideas:[], assignments:{} };
  const commandHash = hash(cmd), session = getMongoClient().startSession(), now = new Date().toISOString();
  try {
    await session.withTransaction(async () => {
      const prior = await db.collection<HistoryDocument>(HISTORY).findOne({ _id:cmd.requestId }, { session });
      if (prior) { if (prior.actor !== actor || prior.commandHash !== commandHash) throw new WorkspaceConflict("Request ID already used for a different change"); return; }
      if (cmd.action === "save-idea" || cmd.action === "publish-idea" || cmd.action === "unpublish-idea") {
        if (!ideas.ideas.some(i => i.id === cmd.id)) throw new WorkspaceInput("Create or select a private idea first");
        const drafts = db.collection<IdeaDraft & { _id:string }>(IDEA_DRAFTS), before = await drafts.findOne({ _id:cmd.id }, { session });
        if ((before?.revision ?? 0) !== cmd.revision) throw new WorkspaceConflict("Idea changed. Reload the latest version.");
        const revision = cmd.revision + 1;
        const fields = cmd.action === "save-idea" ? cmd.fields : before?.fields;
        if (!fields) throw new WorkspaceInput("Save your idea draft first");
        if (cmd.action === "save-idea") {
          const original=ideas.ideas.find(i=>i.id===cmd.id)!;
          try {
            await context!.repository.mutateInSession({action:"update",revision:ideas.revision,ideaId:cmd.id,fields:{name:fields.title,thesis:fields.thesis,target:fields.target,invalidation:fields.invalidation,notes:original.notes}},new Set(),actor,session);
          } catch(error) { if(error instanceof IdeaConflictError) throw new WorkspaceConflict(error.message); throw error; }
        }
        const tradeIds = cmd.action === "save-idea" ? Object.entries(ideas.assignments).filter(([,id])=>id===cmd.id).map(([id])=>id) : before?.tradeIds ?? [];
        const doc = { _id:cmd.id, id:cmd.id, revision, fields, tradeIds, published: cmd.action === "save-idea" ? before?.published ?? false : cmd.action === "publish-idea", publishedRevision: cmd.action === "publish-idea" ? revision : before?.publishedRevision ?? null, firstPublishedAt:before?.firstPublishedAt ?? (cmd.action === "publish-idea"?now:undefined) };
        await drafts.replaceOne({ _id:cmd.id }, doc, { session, upsert:true });
        const published = db.collection<PublicIdea & { _id:string }>(PUBLIC_IDEAS);
        if (cmd.action === "publish-idea") {
          const old = await published.findOne({ _id:cmd.id }, { session });
          const valid=publicIdeaSchema.safeParse(fields);
          if (!valid.success) throw new WorkspaceInput(valid.error.issues[0]?.message??"Complete the idea before publishing");
          if (!fields.target.trim() || !fields.invalidation.trim()) throw new WorkspaceInput("Add a target/scenario and invalidation before publishing an idea");
          const publication = { _id:cmd.id, id:cmd.id, ...fields, updates:(fields.updates ?? []).map(update => ({...update,publishedAt:old?.updates?.find(u=>u.id===update.id)?.publishedAt ?? now})), tradeIds, firstPublishedAt:old?.firstPublishedAt ?? doc.firstPublishedAt ?? now, updatedAt:now };
          await published.replaceOne({ _id:cmd.id }, publication, { session, upsert:true });
          if (before?.publishedRevision == null) {
            // First publication explicitly adopts saved legacy memberships. Later
            // narrative updates never move trades or undo trade-level decisions.
            const existingPublic = await db.collection<PerformanceTrade>("performance_published_trades").find({ id:{ $in:tradeIds } },{session,projection:{id:1}}).toArray();
            for(const trade of existingPublic) {
              const priorAssignment=await db.collection<PublicAssignment>(PUBLIC_ASSIGNMENTS).findOne({_id:trade.id},{session});
              const explicit=await db.collection<PublicEditDocument>(PUBLIC_EDITS).findOne({_id:trade.id},{session});
              if(priorAssignment?.origin==="trade"||explicit)continue;
              await db.collection<PublicAssignment>(PUBLIC_ASSIGNMENTS).updateOne({_id:trade.id},{$set:{ideaId:cmd.id,origin:"idea"}},{upsert:true,session});
            }
          }
        } else if (cmd.action === "unpublish-idea") await published.deleteOne({ _id:cmd.id }, { session });
        await db.collection<HistoryDocument>(HISTORY).insertOne({ _id:cmd.requestId, actor, commandHash, tradeId:cmd.id, action:cmd.action, revision, at:now, reason:fields.title, before, after:doc }, { session });
        return;
      }
      const catalogue = await sources(session), source = catalogue.rows.find(r => r.id === cmd.id);
      if (!source) throw new WorkspaceInput("Trade no longer exists in this journal");
      if (cmd.action === "save-asr") {
        const reviews = db.collection<AsrDocument>(ASR_REVIEWS), before = await reviews.findOne({_id:cmd.id},{session});
        if ((before?.revision ?? 0) !== cmd.revision) throw new WorkspaceConflict("ASR changed in another tab. Reload before saving.");
        const reconciliation = await db.collection<EditDocument>(EDITS).findOne({_id:cmd.id},{session});
        const annotations = await getTradeAnnotations([cmd.id]);
        const basis = reconciliation?.edit ?? initialEdit(source,annotations[cmd.id]??EMPTY_ANNOTATION,ideas.assignments[cmd.id]??null);
        const after:AsrDocument = {_id:cmd.id,revision:cmd.revision+1,fields:cmd.fields,updatedAt:now,basisFingerprint:hash({facts:basis.facts,riskR:basis.riskR})};
        await reviews.replaceOne({_id:cmd.id},after,{upsert:true,session});
        await db.collection<HistoryDocument>(HISTORY).insertOne({_id:cmd.requestId,actor,commandHash,tradeId:cmd.id,action:cmd.action,revision:after.revision,at:now,reason:"Private ASR saved",before,after},{session});
        return;
      }
      const collection = db.collection<EditDocument>(EDITS), before = await collection.findOne({ _id:cmd.id }, { session });
      if ((before?.revision ?? 0) !== cmd.revision) throw new WorkspaceConflict("Trade changed in another tab. Your draft is retained; reload before saving.");
      if (cmd.action === "save" || cmd.action === "restore") {
        let edit: TradeEdit;
        if (cmd.action === "restore") {
          const historical = await db.collection<HistoryDocument>(HISTORY).findOne({ _id:cmd.historyId, tradeId:cmd.id }, { session });
          const previous = historical?.after as EditDocument | null;
          if (!previous?.edit) throw new WorkspaceInput("That revision is not a restorable trade draft");
          edit = editSchema.parse({ ...previous.edit, reason:`Restore revision ${historical!.revision}: ${previous.edit.reason}` });
          if(previous.sourceFingerprint!==source.sourceFingerprint) edit={...edit,resolveHold:false,inclusion:edit.inclusion==="included"?"held":edit.inclusion};
        } else {
          if (source.sourceFingerprint !== cmd.sourceFingerprint) throw new WorkspaceConflict("Original evidence changed. Reload and review the new evidence.");
          edit = cmd.edit;
        }
        // Reconciliation and restoration do not edit assessments; ASR has its own revision stream.
        const legacyAnnotations = before ? null : await getTradeAnnotations([cmd.id]);
        const previousReview = before?.edit ?? initialEdit(source,legacyAnnotations?.[cmd.id]??EMPTY_ANNOTATION,ideas.assignments[cmd.id]??null);
        edit = {...edit,expectedR:previousReview.expectedR,valid:previousReview.valid,asrComments:previousReview.asrComments};
        if (edit.ideaId && !ideas.ideas.some(i => i.id === edit.ideaId)) throw new WorkspaceInput("Selected idea no longer exists");
        if (edit.resultMode === "source" && (edit.netPnl === null || edit.riskBasis === null) && edit.facts.resultR !== source.facts.resultR) throw new WorkspaceInput("Choose manually reconciled R when original calculation inputs are unavailable");
        if (source.duplicateOf && edit.inclusion === "included") throw new WorkspaceInput("This is a recorded duplicate. Edit the canonical trade instead, or keep it excluded.");
        if (source.held && edit.inclusion === "included" && !edit.resolveHold) throw new WorkspaceInput("Review the source evidence and explicitly resolve the hold");
        const after:EditDocument = { _id:cmd.id, revision:cmd.revision+1, edit, sourceFingerprint:source.sourceFingerprint, original:before?.original ?? source, updatedAt:now };
        await collection.replaceOne({ _id:cmd.id }, after, { session, upsert:true });
        await db.collection<HistoryDocument>(HISTORY).insertOne({ _id:cmd.requestId, actor, commandHash, tradeId:cmd.id, action:cmd.action, revision:after.revision, at:now, reason:edit.reason, before, after }, { session });
      } else {
        if (!before) throw new WorkspaceInput("Save your reconciled trade before publication");
        if (before.sourceFingerprint !== source.sourceFingerprint) throw new WorkspaceConflict("Source evidence changed since the draft. Review and save again before publishing.");
        const edit = editSchema.parse(before.edit), boundary = activeBreakoutHistoryFrom(catalogue.account);
        if (source.archived) throw new WorkspaceInput("Archived Bybit history remains outside the active source period. Editing does not reactivate it.");
        if (edit.inclusion === "included") {
          if (source.source === "breakout" && (!boundary || source.facts.openedAt < boundary || edit.facts.openedAt < boundary)) throw new WorkspaceInput("Confirm the Breakout source period in Imports before publishing");
          if (source.source === "bybit" && boundary && !isLegacyHistory({ openedAt:edit.facts.openedAt, closedAt:edit.facts.closedAt! }, { historyFrom:boundary })) throw new WorkspaceInput("Corrected dates cross the active Breakout source boundary");
          if (source.held && !edit.resolveHold) throw new WorkspaceInput("Resolve this reconciliation hold first");
        }
        // An account write serializes publication with source activation and import evidence.
        if (catalogue.account) await db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).updateOne({ _id:BREAKOUT_ACCOUNT_ID }, { $inc:{ importRevision:1 } }, { session });
        const priorPublic = await db.collection<PublicEditDocument>(PUBLIC_EDITS).findOne({ _id:cmd.id }, { session });
        const publicDoc:PublicEditDocument = { _id:cmd.id, revision:before.revision, trade:edit.inclusion === "included" ? publicFacts(cmd.id, source.source, edit) : null, inclusion:edit.inclusion, ideaId:edit.ideaId, updatedAt:now };
        if (publicDoc.trade && !catalogue.published.some(t => t.id === cmd.id)) {
          await db.collection<PerformanceTrade & { _id:string; publishedAt:Date; updatedAt:Date }>("performance_published_trades").insertOne({ ...publicDoc.trade, _id:cmd.id, openedAt:source.facts.openedAt, closedAt:source.facts.closedAt ?? publicDoc.trade.closedAt, publishedAt:new Date(), updatedAt:new Date() }, { session });
        }
        await db.collection<PublicEditDocument>(PUBLIC_EDITS).replaceOne({ _id:cmd.id }, publicDoc, { session, upsert:true });
        await db.collection<PublicAssignment>(PUBLIC_ASSIGNMENTS).updateOne({_id:cmd.id},{$set:{ideaId:edit.ideaId,origin:"trade"}},{upsert:true,session});
        await db.collection<HistoryDocument>(HISTORY).insertOne({ _id:cmd.requestId, actor, commandHash, tradeId:cmd.id, action:"publish", revision:before.revision, at:now, reason:edit.reason, before:priorPublic, after:publicDoc }, { session });
      }
    }, { readConcern:{ level:"snapshot" }, writeConcern:{ w:"majority" }, timeoutMS:30000 });
  } catch(e) {
    if (e instanceof z.ZodError) throw new WorkspaceInput(e.issues[0]?.message ?? "Invalid draft");
    if (e && typeof e === "object" && "code" in e && e.code === 11000) throw new WorkspaceConflict("Workspace changed concurrently. Reload and check the saved state.");
    throw e;
  } finally { await session.endSession(); }
  return getWorkspace();
}
