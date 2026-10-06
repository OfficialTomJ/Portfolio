import { randomUUID } from "node:crypto";
import { type Db, MongoServerError } from "mongodb";
import type { Destination } from "./model";
import type { RecoveryOptions } from "./service";

// Longer than the 60-second function ceiling. A terminated run becomes recoverable.
export const WORKER_LEASE_MS = 90_000;
export const WORKER_BUDGET_MS = 50_000;
export type RecoveryCounts = { pendingProofs: number; pendingContacts: number; dueContacts: number; attentionContacts: number };
type State = {
  _id: string;
  lease?: { token: string; expiresAt: Date };
  lastStartedAt?: Date;
  lastFinishedAt?: Date;
  lastSucceededAt?: Date;
  lastFailedAt?: Date;
  lastError?: string;
  lastProcessed?: number;
};
export class CommunityWorker {
  private readonly states;
  private readonly flows;
  private readonly contacts;
  private readonly id;
  constructor(db: Db, prefix: string, private readonly destination: Destination,
    private readonly processor: { processDue(options?: RecoveryOptions): Promise<number> }, private readonly clock = () => new Date()) {
    this.states = db.collection<State>(`${prefix}WorkerState`);
    this.flows = db.collection(`${prefix}VerificationFlows`);
    this.contacts = db.collection(`${prefix}Contacts`);
    this.id = `${destination.guildId}:${destination.roleId}:${destination.segmentId}`;
  }
  async counts(): Promise<RecoveryCounts> {
    const scope = { ...this.destination, state: { $ne: "blocked" } };
    const [pendingProofs, pendingContacts, dueContacts, attentionContacts] = await Promise.all([
      this.flows.countDocuments({ purpose: "connect", state: "verified", purgeAt: { $exists: false } }),
      this.contacts.countDocuments({ ...scope, $or: [{ "roleJob.status": "pending" }, { "listJob.status": "pending" }] }),
      this.contacts.countDocuments({ ...scope, $or: [
        { "roleJob.status": "pending", "roleJob.nextAt": { $lte: this.clock() } },
        { "listJob.status": "pending", "listJob.nextAt": { $lte: this.clock() } },
      ] }),
      this.contacts.countDocuments({ ...scope, $or: [{ "roleJob.status": "attention" }, { "listJob.status": "attention" }] }),
    ]);
    return { pendingProofs, pendingContacts, dueContacts, attentionContacts };
  }
  async status() {
    const [state, jobs] = await Promise.all([this.states.findOne({ _id: this.id }), this.counts()]);
    return { running: Boolean(state?.lease && state.lease.expiresAt > this.clock()),
      lastStartedAt: state?.lastStartedAt ?? null, lastFinishedAt: state?.lastFinishedAt ?? null,
      lastSucceededAt: state?.lastSucceededAt ?? null, lastFailedAt: state?.lastFailedAt ?? null,
      lastError: state?.lastError ?? null, lastProcessed: state?.lastProcessed ?? null, jobs };
  }
  async run() {
    const now = this.clock(); const token = randomUUID();
    let acquired;
    try {
      acquired = await this.states.findOneAndUpdate({ _id: this.id,
        $or: [{ lease: { $exists: false } }, { "lease.expiresAt": { $lte: now } }] },
      { $set: { lease: { token, expiresAt: new Date(now.getTime() + WORKER_LEASE_MS) }, lastStartedAt: now } },
      { upsert: true, returnDocument: "after" });
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
    }
    if (!acquired) return { skipped: "already_running" as const, processed: 0, jobs: await this.counts() };
    try {
      const processed = await this.processor.processDue({ deadline: new Date(now.getTime() + WORKER_BUDGET_MS) });
      const jobs = await this.counts();
      const finished = this.clock();
      await this.states.updateOne({ _id: this.id, "lease.token": token },
        { $set: { lastFinishedAt: finished, lastSucceededAt: finished, lastProcessed: processed }, $unset: { lease: "", lastError: "" } });
      return { processed, jobs };
    } catch (error) {
      const finished = this.clock();
      await this.states.updateOne({ _id: this.id, "lease.token": token },
        { $set: { lastFinishedAt: finished, lastFailedAt: finished, lastError: "Recovery processing failed." }, $unset: { lease: "" } });
      throw error;
    }
  }
}
