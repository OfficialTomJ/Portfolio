import { randomUUID } from "node:crypto";
import { type Db, type Filter, MongoServerError } from "mongodb";
import {
  CODE_MS, MAX_ATTEMPTS, CommunityError, type Contact, type Destination, type DiscordIdentity,
  type Flow, type Repository,
} from "./model";
import { freshJob, newContact } from "./service";
import { equal } from "./security";

const conflict = () => new CommunityError("conflict", "This email or Discord account already has a connection. Manage the existing connection first.", 409);
export class MongoCommunityRepository implements Repository {
  private readonly flows;
  private readonly contacts;
  private readonly counters;
  private readonly trusted;
  private ready?: Promise<unknown>;
  constructor(db: Db, prefix = "community") {
    this.flows = db.collection<Flow>(`${prefix}VerificationFlows`);
    this.contacts = db.collection<Contact>(`${prefix}Contacts`);
    this.counters = db.collection<{ _id: string; count: number; expiresAt: Date }>(`${prefix}Limits`);
    this.trusted = db.collection<{ _id: string; guildId: string; discordId: string; recordedAt: Date; source: "existing-member" }>(`${prefix}TrustedMembers`);
  }
  private indexes() {
    this.ready ??= Promise.all([
      this.flows.createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
      this.contacts.createIndex({ email: 1 }, { unique: true }),
      this.contacts.createIndex({ discordId: 1 }, { unique: true, partialFilterExpression: { discordId: { $type: "string" } } }),
      this.contacts.createIndex({ claimedUserId: 1 }, { unique: true, partialFilterExpression: { claimedUserId: { $type: "string" } } }),
      this.counters.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((error) => { this.ready = undefined; throw error; });
    return this.ready;
  }
  private unlocked(now: Date): Filter<Contact> {
    return { $or: [{ lease: { $exists: false } }, { "lease.expiresAt": { $lte: now } }] };
  }
  async putFlow(flow: Flow) { await this.indexes(); await this.flows.insertOne({ ...flow, purgeAt: flow.expiresAt }); }
  async flow(id: string, now: Date) { return this.flows.findOne({ _id: id, expiresAt: { $gt: now } }); }
  async takeOAuth(id: string, oauthHash: string, now: Date) {
    return (await this.flows.updateOne({ _id: id, state: "oauth", oauthHash, expiresAt: { $gt: now } },
      { $unset: { oauthHash: "" } })).modifiedCount === 1;
  }
  async setDiscord(id: string, discord: DiscordIdentity, now: Date) {
    const result = await this.flows.updateOne({ _id: id, state: "oauth", oauthHash: { $exists: false }, expiresAt: { $gt: now } },
      { $set: { discord, state: "email" } });
    if (!result.modifiedCount) throw new CommunityError("expired", "Start Discord verification again.", 401);
  }
  async reserveCode(id: string, email: string, codeHash: string, now: Date) {
    const result = await this.flows.updateOne({ _id: id, state: { $in: ["email", "sent"] },
      expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS },
      $or: [{ lastSentAt: { $exists: false } }, { lastSentAt: { $lte: new Date(now.getTime() - 60_000) } }] },
    { $set: { state: "sending", email, codeHash, lastSentAt: now,
      codeExpiresAt: new Date(now.getTime() + CODE_MS), enrollmentAcceptedAt: now } });
    return result.modifiedCount === 1;
  }
  async finishSend(id: string, codeHash: string, sent: boolean) {
    await this.flows.updateOne({ _id: id, state: "sending", codeHash }, sent
      ? { $set: { state: "sent" } }
      : { $set: { state: "email" }, $unset: { codeHash: "", codeExpiresAt: "" } });
  }
  async verifyCode(id: string, codeHash: string, now: Date, purpose: Flow["purpose"]) {
    // Reserve a guess before comparing it, so parallel wrong guesses cannot exceed the budget.
    const attempt = await this.flows.findOneAndUpdate({ _id: id, state: "sent", purpose,
      attempts: { $lt: MAX_ATTEMPTS }, expiresAt: { $gt: now } },
    { $inc: { attempts: 1 } }, { returnDocument: "before" });
    if (!attempt?.codeHash || !equal(attempt.codeHash, codeHash)) return null;
    return this.flows.findOneAndUpdate({ _id: id, state: "sent", codeHash, purpose,
      expiresAt: { $gt: now }, codeExpiresAt: { $gt: now } },
    { $set: { state: "verified", verifiedAt: now }, $unset: { codeHash: "", codeExpiresAt: "",
      ...(purpose === "connect" ? { purgeAt: "" as const } : {}) } },
    { returnDocument: "after" });
  }
  async pendingProofs(max: number) {
    return this.flows.find({ purpose: "connect", state: "verified", purgeAt: { $exists: false } })
      .sort({ verifiedAt: 1 }).limit(max).toArray();
  }
  async finishEnrollment(id: string) {
    await this.flows.updateOne({ _id: id, state: "verified" }, [{ $set: { purgeAt: "$expiresAt" } }]);
  }
  async limit(key: string, max: number, seconds: number, now: Date) {
    await this.indexes();
    const start = Math.floor(now.getTime() / (seconds * 1000)) * seconds * 1000;
    const _id = `${key}:${start}`;
    // Upsert can race on a cold counter; retry the increment only after a duplicate-key failure.
    let result;
    try {
      result = await this.counters.findOneAndUpdate({ _id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(start + seconds * 1000) } },
        { upsert: true, returnDocument: "after" });
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
      result = await this.counters.findOneAndUpdate({ _id }, { $inc: { count: 1 } }, { returnDocument: "after" });
    }
    return Boolean(result && result.count <= max);
  }
  async enroll(flow: Flow, destination: Destination, now: Date) {
    await this.indexes();
    const proposed = newContact(flow, destination, now);
    let existing = await this.contacts.findOne({ email: proposed.email });
    if (!existing) {
      try { await this.contacts.insertOne(proposed); return proposed; }
      catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
        existing = await this.contacts.findOne({ email: proposed.email });
        if (!existing) throw conflict();
      }
    }
    // A completed flow is idempotent even after unlinking: status must never restore revoked access.
    if (existing.state === "blocked") throw new CommunityError("blocked", "Community access is restricted. Contact support.", 403);
    if (existing.lastVerificationFlowId === flow._id) return existing;
    if (existing.state === "revoking" || existing.discordId && existing.discordId !== proposed.discordId ||
      existing.revokedAt && proposed.verifiedAt <= existing.revokedAt ||
      existing.guildId !== destination.guildId || existing.roleId !== destination.roleId || existing.segmentId !== destination.segmentId) {
      throw conflict();
    }
    try {
      const result = await this.contacts.findOneAndUpdate({ _id: existing._id, generation: existing.generation,
        state: { $in: ["active", "unlinked"] }, ...this.unlocked(now) },
      { $set: { discordId: proposed.discordId, discordName: proposed.discordName, state: "active",
        verifiedAt: proposed.verifiedAt, lastVerificationFlowId: flow._id, roleJob: freshJob(now) }, $inc: { generation: 1 } },
      { returnDocument: "after" });
      if (!result) throw new CommunityError("busy", "Your connection is updating. Please retry shortly.", 409);
      return result;
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw conflict();
      throw error;
    }
  }
  async contact(email: string) { return this.contacts.findOne({ email }); }
  async lease(id: string, now: Date) {
    const token = randomUUID();
    const contact = await this.contacts.findOneAndUpdate({ _id: id, ...this.unlocked(now) },
      { $set: { lease: { token, expiresAt: new Date(now.getTime() + 120_000) } } }, { returnDocument: "after" });
    return contact ? { contact, token } : null;
  }
  async saveLease(contact: Contact, token: string) {
    const { roleJob, listJob, state, revokedDiscordIds, retainedCommunityAccess } = contact;
    // Never overwrite claimed identity, a moderation restriction, or connection generation from a stale snapshot.
    const result = await this.contacts.updateOne({ _id: contact._id, "lease.token": token, generation: contact.generation },
      { $set: { roleJob, listJob, state, revokedDiscordIds: revokedDiscordIds ?? [],
        retainedCommunityAccess: retainedCommunityAccess ?? false,
        ...(contact.resendContactId ? { resendContactId: contact.resendContactId, unsubscribed: contact.unsubscribed } : {}) },
      ...(state === "unlinked" ? { $unset: { discordId: "", discordName: "" } } : {}) });
    return result.matchedCount === 1;
  }
  async release(id: string, token: string) {
    await this.contacts.updateOne({ _id: id, "lease.token": token }, { $unset: { lease: "" } });
  }
  async revoke(email: string, now: Date) {
    const existing = await this.contacts.findOne({ email });
    if (!existing || existing.state === "unlinked" || existing.state === "revoking") return existing;
    if (existing.state === "blocked") throw new CommunityError("blocked", "Contact support to manage this connection.", 403);
    const result = await this.contacts.findOneAndUpdate({ _id: existing._id, state: "active", generation: existing.generation,
      ...this.unlocked(now) }, { $set: { state: "revoking", revokedAt: now, roleJob: freshJob(now) }, $inc: { generation: 1 } },
    { returnDocument: "after" });
    if (!result) throw new CommunityError("busy", "Your connection is updating. Please retry shortly.", 409);
    return result;
  }
  async due(now: Date, max: number, destination?: Destination) {
    return this.contacts.find({ ...destination, state: { $ne: "blocked" }, ...this.unlocked(now), $and: [{ $or: [
      { "roleJob.status": "pending", "roleJob.nextAt": { $lte: now } },
      { "listJob.status": "pending", "listJob.nextAt": { $lte: now } },
    ] }] }).sort({ "roleJob.nextAt": 1, "listJob.nextAt": 1, createdAt: 1 }).limit(max).toArray();
  }
  async claim(email: string, userId: string) {
    await this.indexes();
    const current = await this.contacts.findOne({ claimedUserId: userId });
    if (current) return current; // Keep the original contact through a website email change; no silent merge.
    const contact = await this.contacts.findOne({ email });
    if (!contact) return null;
    if (contact.claimedUserId && contact.claimedUserId !== userId) throw conflict();
    return this.contacts.findOneAndUpdate({ _id: contact._id,
      $or: [{ claimedUserId: { $exists: false } }, { claimedUserId: userId }] },
    { $set: { claimedUserId: userId } }, { returnDocument: "after" });
  }
  async trustedMember(guildId: string, discordId: string) {
    return Boolean(await this.trusted.findOne({ _id: `${guildId}:${discordId}` }));
  }
  // Operator-only import; no browser endpoint may create trusted-member records.
  async recordTrustedMember(guildId: string, discordId: string, now: Date) {
    if (![guildId, discordId].every((id) => /^\d{17,22}$/.test(id))) throw new Error("Invalid Discord member ID.");
    await this.trusted.updateOne({ _id: `${guildId}:${discordId}` },
      { $setOnInsert: { guildId, discordId, recordedAt: now, source: "existing-member" } }, { upsert: true });
  }
  async jobSummary() {
    const [pendingProofs, contacts] = await Promise.all([
      this.flows.countDocuments({ purpose: "connect", state: "verified", purgeAt: { $exists: false } }),
      this.contacts.aggregate([
        { $group: { _id: { state: "$state", role: "$roleJob.status", mailing: "$listJob.status",
          roleError: "$roleJob.error", mailingError: "$listJob.error" }, count: { $sum: 1 } } },
      ]).toArray(),
    ]);
    return { pendingProofs, contacts };
  }
}
