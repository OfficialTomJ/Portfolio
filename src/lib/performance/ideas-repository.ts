import { createHash, randomUUID } from "node:crypto";
import type { ClientSession, Db, MongoClient } from "mongodb";
import type { IdeaGroups, IdeaMutation, TradeIdea } from "./ideas-model";

export class IdeaConflictError extends Error {}
export class IdeaInputError extends Error {}
interface IdeaDocument extends TradeIdea { _id: string; scope: string; deletedAt?: string; linkRevision?: number }
interface AssignmentDocument { _id: string; scope: string; tradeId: string; ideaId: string }
interface StateDocument { _id: string; revision: number }
interface HistoryDocument { _id: string; scope: string; actor: string; at: Date; command: IdeaMutation; before: IdeaGroups }

/** Separate collections keep grouping edits independent of reviews, publication and sync. */
export class IdeasRepository {
  readonly scope: string;
  readonly names: string[];
  constructor(private db: Db, private client: MongoClient, account: { environment: string; sourceAccountId: string }, prefix = "performance_private_ideas") {
    this.scope = createHash("sha256").update(`${account.environment}:${account.sourceAccountId}`).digest("hex");
    this.names = [prefix, `${prefix}_assignments`, `${prefix}_state`, `${prefix}_history`];
  }
  private async read(session: ClientSession): Promise<IdeaGroups> {
    const options = { session };
    // Mongo sessions do not support parallel operations inside a transaction.
    const state = await this.db.collection<StateDocument>(this.names[2]).findOne({ _id: this.scope }, options);
    const ideas = await this.db.collection<IdeaDocument>(this.names[0]).find({ scope: this.scope, deletedAt: { $exists:false } }, options).sort({ createdAt: 1 }).toArray();
    const assignments = await this.db.collection<AssignmentDocument>(this.names[1]).find({ scope: this.scope }, options).toArray();
    return {
      revision: state?.revision ?? 0,
      ideas: ideas.map(doc => ({ id: doc.id, name: doc.name, thesis: doc.thesis, target: doc.target, invalidation: doc.invalidation, notes: doc.notes, createdAt: doc.createdAt, updatedAt: doc.updatedAt })),
      assignments: Object.fromEntries(assignments.map(a => [a.tradeId, a.ideaId])),
    };
  }
  async load(): Promise<IdeaGroups> {
    const session = this.client.startSession();
    try { return await session.withTransaction(() => this.read(session), { readConcern: { level: "snapshot" } }); }
    finally { await session.endSession(); }
  }
  async mutate(command: IdeaMutation, eligibleIds: Set<string>, actor: string): Promise<IdeaGroups> {
    const session = this.client.startSession();
    try {
      return await session.withTransaction(() => this.mutateInSession(command, eligibleIds, actor, session),
        { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } finally { await session.endSession(); }
  }

  /** Serialize saves/publication with deletion so stale tabs cannot recreate a link. */
  async lockIdea(ideaId:string,session:ClientSession):Promise<void> {
    const result=await this.db.collection<IdeaDocument>(this.names[0]).updateOne(
      {scope:this.scope,id:ideaId,deletedAt:{$exists:false}},{$inc:{linkRevision:1}},{session},
    );
    if(!result.matchedCount)throw new IdeaInputError("Idea no longer exists. Reload the workspace.");
  }

  /** Join the trade editor's transaction so assignment and review save together. */
  async mutateInSession(command: IdeaMutation, eligibleIds: Set<string>, actor: string, session: ClientSession): Promise<IdeaGroups> {
    if ("tradeIds" in command && command.tradeIds.some(id => !eligibleIds.has(id))) throw new IdeaInputError("A selected trade is unavailable, belongs to another account, or is a duplicate. Reload the workspace.");
    const newId = `idea-${randomUUID()}`;
    try {
      const before = await this.read(session);
      if (before.revision !== command.revision) throw new IdeaConflictError("Ideas changed in another tab. Reload the workspace before saving again.");
      if (command.action !== "create" && command.ideaId && !before.ideas.some(i => i.id === command.ideaId)) throw new IdeaInputError("Idea no longer exists. Reload the workspace.");
      const state = this.db.collection<StateDocument>(this.names[2]);
      if (before.revision === 0) await state.insertOne({ _id: this.scope, revision: 1 }, { session });
      else {
        const updated = await state.updateOne({ _id: this.scope, revision: before.revision }, { $inc: { revision: 1 } }, { session });
        if (updated.modifiedCount !== 1) throw new IdeaConflictError("Ideas changed in another tab. Reload the workspace.");
      }
      const ideas = this.db.collection<IdeaDocument>(this.names[0]);
      const assignments = this.db.collection<AssignmentDocument>(this.names[1]);
      const now = new Date().toISOString();
      if (command.action === "create") {
        await ideas.insertOne({ _id: `${this.scope}:${newId}`, scope: this.scope, id: newId, ...command.fields, createdAt: now, updatedAt: now }, { session });
      } else if (command.action === "update") {
        await ideas.updateOne({ scope: this.scope, id: command.ideaId }, { $set: { ...command.fields, updatedAt: now } }, { session });
      } else if (command.action === "delete") {
        await ideas.updateOne({ scope:this.scope,id:command.ideaId },{$set:{deletedAt:now,updatedAt:now}},{session});
        await assignments.deleteMany({scope:this.scope,ideaId:command.ideaId},{session});
      }
      if (command.action === "create" || command.action === "assign") {
        const ideaId = command.action === "create" ? newId : command.ideaId;
        if (command.tradeIds.length) {
          if (ideaId === null) await assignments.deleteMany({ scope: this.scope, tradeId: { $in: command.tradeIds } }, { session });
          else await assignments.bulkWrite(command.tradeIds.map(tradeId => ({ replaceOne: {
            filter: { _id: `${this.scope}:${tradeId}` }, replacement: { _id: `${this.scope}:${tradeId}`, scope: this.scope, tradeId, ideaId }, upsert: true,
          } })), { session });
        }
      }
      await this.db.collection<HistoryDocument>(this.names[3]).insertOne({ _id: `${this.scope}:${before.revision + 1}`, scope: this.scope, actor, at: new Date(), command, before }, { session });
      return await this.read(session);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) throw new IdeaConflictError("Ideas changed in another tab. Reload the workspace.");
      throw error;
    }
  }
}
