import { randomUUID } from "node:crypto";
import {
  CODE_MS, FLOW_MS, MANAGEMENT_MS, MAX_ATTEMPTS, CommunityError, contactView,
  type AccountIdentity, type Contact, type Destination, type Flow, type Job, type Providers, type Repository,
} from "./model";
import { codeDigest, digest, normalizeEmail, randomCode, randomToken } from "./security";

export class ProviderError extends Error {
  constructor(public readonly publicMessage: string, public readonly retryable: boolean,
    public readonly retryAfter = 60) { super(publicMessage); }
}
export type RecoveryOptions = { deadline?: Date };
export class CommunityService {
  constructor(private readonly repo: Repository, private readonly providers: Providers,
    private readonly secret: string, private readonly destination: Destination,
    private readonly testRecipients?: string[], private readonly clock = () => new Date()) {}

  flowId(token: string) {
    if (!/^[\w-]{43}$/.test(token)) throw new CommunityError("session", "Start verification again.", 401);
    return digest(this.secret, "flow", token);
  }
  private async requireFlow(token: string) {
    const flow = await this.repo.flow(this.flowId(token), this.clock());
    if (!flow) throw new CommunityError("expired", "Verification expired. Start again.", 401);
    return flow;
  }
  private async limit(key: string, max: number, seconds: number) {
    if (!await this.repo.limit(digest(this.secret, "limit", key), max, seconds, this.clock())) {
      throw new CommunityError("rate", "Too many requests. Please wait and try again.", 429);
    }
  }
  private async enroll(flow: Flow) {
    try {
      const contact = await this.repo.enroll(flow, this.destination, this.clock());
      await this.repo.finishEnrollment(flow._id);
      return contact;
    } catch (error) {
      if (error instanceof CommunityError && ["conflict", "blocked"].includes(error.code)) {
        await this.repo.finishEnrollment(flow._id);
      }
      throw error;
    }
  }
  private async view(contact: Contact | null) {
    const trusted = contact?.discordId
      ? await this.repo.trustedMember(contact.guildId, contact.discordId)
      : contact?.retainedCommunityAccess ?? false;
    return contactView(contact, trusted);
  }
  private async accountContact(user: AccountIdentity | null) {
    if (!user?.id || !user.emailVerified) throw new CommunityError("account", "Sign in with a verified Mentor account to manage its connection.", 401);
    return this.repo.claim(normalizeEmail(user.email), user.id);
  }
  async profile(user: AccountIdentity | null) {
    const contact = await this.accountContact(user);
    return { contact: await this.view(contact), managementEmail: contact?.email ?? user!.email };
  }
  async disconnectAccount(user: AccountIdentity | null) {
    const contact = await this.accountContact(user);
    await this.limit(`disconnect:account:${user!.id}`, 10, 900);
    if (contact) {
      await this.repo.revoke(contact.email, this.clock());
      await this.process(contact._id, true);
    }
    return this.profile(user);
  }
  async retryAccount(user: AccountIdentity | null) {
    const contact = await this.accountContact(user);
    await this.limit(`retry:account:${user!.id}`, 10, 900);
    if (contact) await this.process(contact._id, true);
    return this.profile(user);
  }
  async start(ip: string, purpose: Flow["purpose"] = "connect", expectedDiscordId?: string) {
    if (expectedDiscordId && (purpose !== "connect" || !/^\d{17,22}$/.test(expectedDiscordId))) {
      throw new CommunityError("entry", "Start verification again from Discord.");
    }
    await this.limit(`start:${ip}`, 20, 900);
    const token = randomToken(); const state = randomToken(); const now = this.clock();
    await this.repo.putFlow({ _id: this.flowId(token), purpose, state: purpose === "connect" ? "oauth" : "email",
      oauthHash: purpose === "connect" ? digest(this.secret, "oauth", state) : undefined,
      expiresAt: new Date(now.getTime() + FLOW_MS), attempts: 0, ...(expectedDiscordId ? { expectedDiscordId } : {}) });
    return { token, state };
  }
  async callback(token: string, state: string, code: string) {
    if (state.length > 100 || code.length > 2048 || !code) throw new CommunityError("oauth", "Discord authorization was not completed.");
    const flow = await this.requireFlow(token);
    if (flow.purpose !== "connect" || !await this.repo.takeOAuth(flow._id, digest(this.secret, "oauth", state), this.clock())) {
      throw new CommunityError("oauth", "Discord authorization expired or did not match this browser.", 403);
    }
    const identity = await this.providers.identity(code);
    if (flow.expectedDiscordId && flow.expectedDiscordId !== identity.id) {
      throw new CommunityError("discord_identity", "Use the Discord account that clicked Start verification. Return to Discord and start again.", 403);
    }
    // Screening can be completed after identity confirmation; role processing checks it again.
    await this.providers.member(this.destination.guildId, identity.id);
    await this.repo.setDiscord(flow._id, identity, this.clock());
  }
  async send(token: string, rawEmail: string, ip: string, accepted: boolean) {
    const flow = await this.requireFlow(token); const email = normalizeEmail(rawEmail);
    if (flow.purpose === "connect" && (!flow.discord || !accepted)) {
      throw new CommunityError("flow", "Connect Discord and acknowledge the community email-list notice first.");
    }
    if (flow.state === "verified" || flow.state === "oauth" || flow.attempts >= MAX_ATTEMPTS) {
      throw new CommunityError("flow", "Start a new verification to request another code.");
    }
    if (this.testRecipients && !this.testRecipients.includes(email)) {
      throw new CommunityError("test_recipient", "This pilot only sends codes to configured test inboxes.", 403);
    }
    await this.limit(`send:ip:${ip}`, 15, 3600);
    await this.limit(`send:email:${email}`, 5, 3600);
    if (flow.discord) await this.limit(`send:discord:${flow.discord.id}`, 5, 3600);
    await this.limit("send:daily", 80, 86400); // Leave headroom for account mail; provider enforces shared quota.
    const code = randomCode(); const hash = codeDigest(this.secret, flow, email, code);
    if (!await this.repo.reserveCode(flow._id, email, hash, this.clock())) {
      throw new CommunityError("cooldown", "Please wait 60 seconds before sending another code.", 429);
    }
    try {
      await this.providers.email(email, code, flow.purpose, flow.discord?.name);
      await this.repo.finishSend(flow._id, hash, true);
    } catch {
      await this.repo.finishSend(flow._id, hash, false);
      throw new CommunityError("send", "The email could not be sent. Please wait and try again.", 503);
    }
    return { email, expiresIn: CODE_MS / 1000, resendIn: 60 };
  }
  async confirm(token: string, code: string, ip: string) {
    const flow = await this.requireFlow(token);
    if (!/^\d{6}$/.test(code) || !flow.email) throw new CommunityError("code", "Enter the six-digit code.");
    await this.limit(`guess:email:${flow.email}`, 10, 900);
    await this.limit(`guess:ip:${ip}`, 30, 900);
    const verified = await this.repo.verifyCode(flow._id, codeDigest(this.secret, flow, flow.email, code), this.clock(), flow.purpose);
    if (!verified) {
      throw new CommunityError("code", "Code is incorrect, expired, or already used. Request a new code if needed.");
    }
    if (verified.purpose === "connect") await this.enroll(verified);
    return this.status(token);
  }
  async status(token: string) {
    const flow = await this.requireFlow(token);
    let contact: Contact | null = null;
    if (flow.state === "verified" && flow.email) {
      // Recover a crash after consuming the code but before durable contact creation.
      contact = flow.purpose === "connect"
        ? await this.enroll(flow)
        : await this.repo.contact(flow.email);
    }
    return { stage: flow.state, purpose: flow.purpose, discordName: flow.discord?.name ?? null,
      email: flow.email ?? null, contact: await this.view(contact), managementExpiresIn: MANAGEMENT_MS / 1000 };
  }
  async retry(token: string) {
    const flow = await this.requireFlow(token);
    if (flow.state !== "verified" || !flow.email) throw new CommunityError("session", "Verify your email first.", 401);
    await this.limit(`retry:${flow.email}`, 10, 900);
    if (flow.purpose === "connect") await this.enroll(flow);
    const contact = await this.repo.contact(flow.email);
    if (contact) await this.process(contact._id, true);
    return this.status(token);
  }
  async disconnect(token: string) {
    const flow = await this.requireFlow(token);
    if (flow.purpose !== "manage" || flow.state !== "verified" || !flow.email || !flow.verifiedAt ||
      this.clock().getTime() - flow.verifiedAt.getTime() >= MANAGEMENT_MS) {
      throw new CommunityError("reauth", "Verify a fresh management code to unlink Discord.", 401);
    }
    const contact = await this.repo.revoke(flow.email, this.clock());
    if (contact) await this.process(contact._id, true);
    return this.status(token);
  }
  private failure(job: Job, error: unknown) {
    const known = error instanceof ProviderError;
    job.attempts += 1;
    job.status = known && !error.retryable ? "attention" : "pending";
    job.error = known ? error.publicMessage : "Activation is delayed. Try again shortly.";
    const seconds = Math.max(known ? error.retryAfter : 60, Math.min(3600, 15 * 2 ** Math.min(job.attempts, 8)));
    job.nextAt = new Date(this.clock().getTime() + seconds * 1000);
  }
  async process(id: string, manual = false, deadline = new Date(this.clock().getTime() + 50_000)) {
    const leased = await this.repo.lease(id, this.clock());
    if (!leased) return;
    const { contact, token } = leased;
    try {
      if (contact.state === "blocked") return;
      // Reserve time for the bounded provider requests and persist each completed stage.
      // Role activation can make two 10s requests; list sync can make four.
      const hasTime = (budget: number) => this.clock().getTime() + budget <= deadline.getTime();
      if (hasTime(22_000) && contact.roleJob.status !== "done" && contact.discordId &&
        (manual && contact.roleJob.status === "attention" || contact.roleJob.status === "pending" && contact.roleJob.nextAt <= this.clock())) {
        try {
          if (contact.state === "active") {
            const member = await this.providers.member(contact.guildId, contact.discordId);
            if (member.pending) throw new ProviderError("Accept the server rules in Discord, then retry activation.", true);
          }
          const retainAccess = contact.state === "revoking" && await this.repo.trustedMember(contact.guildId, contact.discordId);
          if (!retainAccess) await this.providers.role(contact.guildId, contact.discordId, contact.roleId,
            contact.state === "revoking" ? "remove" : "grant");
          contact.roleJob.status = "done"; delete contact.roleJob.error;
          if (contact.state === "revoking") {
            contact.retainedCommunityAccess = retainAccess;
            contact.revokedDiscordIds = [...new Set([...(contact.revokedDiscordIds ?? []), contact.discordId])];
            contact.state = "unlinked"; delete contact.discordId; delete contact.discordName;
          }
        } catch (error) { this.failure(contact.roleJob, error); }
        if (!await this.repo.saveLease(contact, token)) return;
      }
      if (hasTime(42_000) && contact.listJob.status !== "done" &&
        (manual && contact.listJob.status === "attention" || contact.listJob.status === "pending" && contact.listJob.nextAt <= this.clock())) {
        try {
          const subscribed = await this.providers.subscribe(contact.email, contact.segmentId);
          contact.resendContactId = subscribed.id; contact.unsubscribed = subscribed.unsubscribed;
          contact.listJob.status = "done"; delete contact.listJob.error;
        } catch (error) { this.failure(contact.listJob, error); }
        await this.repo.saveLease(contact, token);
      }
    } finally { await this.repo.release(contact._id, token); }
  }
  async processDue({ deadline }: RecoveryOptions = {}) {
    // Consumed proof is durable until contact creation succeeds, even if the browser/request disappears.
    const proofs = await this.repo.pendingProofs(3);
    for (const proof of proofs) {
      if (deadline && this.clock().getTime() + 10_000 > deadline.getTime()) break;
      try { await this.enroll(proof); } catch { /* Leave transient failures for the next worker run. */ }
    }
    const contacts = await this.repo.due(this.clock(), 3, this.destination);
    // Sequential API calls respect provider budgets and bounded worker duration.
    let processed = 0;
    for (const contact of contacts) {
      if (deadline && this.clock().getTime() + 22_000 > deadline.getTime()) break;
      await this.process(contact._id, false, deadline);
      processed++;
    }
    return processed;
  }
}

export function freshJob(now: Date): Job { return { status: "pending", attempts: 0, nextAt: now }; }
export function newContact(flow: Flow, destination: Destination, now: Date): Contact {
  if (!flow.discord || !flow.email || flow.state !== "verified" || !flow.enrollmentAcceptedAt) {
    throw new CommunityError("proof", "Complete community verification first.", 401);
  }
  return { _id: randomUUID(), email: flow.email, createdAt: now, verifiedAt: flow.verifiedAt ?? now,
    enrollmentVersion: 1, enrollmentAcceptedAt: flow.enrollmentAcceptedAt,
    discordId: flow.discord.id, discordName: flow.discord.name, ...destination,
    state: "active", lastVerificationFlowId: flow._id, generation: 1, roleJob: freshJob(now), listJob: freshJob(now) };
}
