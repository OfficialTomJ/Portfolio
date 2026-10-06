import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { type Db, MongoServerError } from "mongodb";
import type { CommunityConfig } from "./config";
import { CommunityError, FLOW_MS, type Contact } from "./model";
import { digest, randomToken } from "./security";
import { START_BUTTON, STATUS_BUTTON, type ButtonInteraction } from "./interaction-security";

type Member = { roles: string[]; pending?: boolean };
type StatusContact = Pick<Contact, "state" | "roleJob"> | null;
type Watch = { _id: string; guildId: string; discordId: string; interactionId: string; encryptedToken: string;
  expiresAt: Date; nextAt: Date; components: ReturnType<typeof actionRow>; lastContent?: string; presentationVersion?: number;
  lease?: { token: string; expiresAt: Date } };
type Entry = { _id: string; guildId: string; discordId: string; expiresAt: Date };
const actionRow = (components: Record<string, unknown>[]) => [{ type: 1, components }];
const statusButton = { type: 2, style: 2, label: "Check status", custom_id: STATUS_BUTTON };
export function privateComponents(complete: boolean, url?: string) {
  return actionRow(complete || !url ? [statusButton] : [{ type: 2, style: 5, label: "Verify email", url }, statusButton]);
}
export const starterMessage = {
  content: "**Verify your email**\nVerify your email to access the community.\nClick Start verification to receive a private link. Check status shows your status privately.",
  allowed_mentions: { parse: [] }, flags: 4096,
  components: actionRow([{ type: 2, style: 1, label: "Start verification", custom_id: START_BUTTON }, statusButton]),
};

export function verificationMessage(member: Member, contact: StatusContact, verifiedRole: string) {
  if (contact?.state === "blocked") return { content: "**Community access restricted**\nContact support for help.", complete: true };
  if (member.pending) return { content: "**Accept the server rules**\nComplete Discord’s rules screening, then check your status again.", complete: false };
  if (contact?.state === "revoking") return { content: "**Removing community access**\nYour Discord connection is being unlinked.", complete: false };
  if (member.roles.includes(verifiedRole)) return { content: "**Verification complete**\nYou now have verified access to the community.", complete: true };
  if (contact?.state === "active" && contact.roleJob.status !== "done") return {
    content: contact.roleJob.status === "attention" ? "**Activation needs attention**\nYour email is verified. Contact support to activate community access."
      : contact.roleJob.attempts > 0 ? "**Activation delayed**\nYour email is verified. We’ll retry activating your community access automatically."
      : "**Activating community access**\nYour email is verified. We’re adding your Verified role.", complete: false,
  };
  return { content: "**Waiting for verification**\nVerify your email on the website to access the community. No account is created.", complete: false };
}

export function sealInteractionToken(value: string, secret: string) {
  const iv = randomBytes(12); const key = createHash("sha256").update(`discord-interaction:${secret}`).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function openInteractionToken(value: string, secret: string) {
  const data = Buffer.from(value, "base64url");
  const key = createHash("sha256").update(`discord-interaction:${secret}`).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

export class DiscordOnboarding {
  private readonly watches; private readonly entries; private ready?: Promise<unknown>;
  constructor(private readonly db: Db, private readonly prefix: string, private readonly config: CommunityConfig,
    private readonly fetcher: typeof fetch = fetch, private readonly clock = () => new Date()) {
    this.watches = db.collection<Watch>(`${prefix}DiscordReplies`);
    this.entries = db.collection<Entry>(`${prefix}DiscordEntries`);
  }
  private indexes() {
    this.ready ??= Promise.all([this.watches.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.entries.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })])
      .catch(error => { this.ready = undefined; throw error; });
    return this.ready;
  }
  private async request(path: string, init: RequestInit = {}) {
    return this.fetcher(`https://discord.com/api/v10${path}`, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(3000) });
  }
  async current(discordId: string) {
    const response = await this.request(`/guilds/${this.config.guildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${this.config.botToken}` } });
    if (response.status === 404) return { content: "**Join the community first**\nJoin the Discord server, then start verification again.", complete: true };
    if (!response.ok) throw new Error("Discord status unavailable");
    const member = await response.json() as Member;
    if (!Array.isArray(member.roles)) throw new Error("Invalid member response");
    const contact = await this.db.collection<Contact>(`${this.prefix}Contacts`).findOne({ discordId,
      guildId: this.config.guildId, roleId: this.config.roleId, segmentId: this.config.segmentId },
    { projection: { state: 1, roleJob: 1 } });
    return verificationMessage(member, contact, this.config.roleId);
  }
  async entry(ticket: string) {
    if (!/^[\w-]{43}$/.test(ticket)) throw new CommunityError("entry", "Return to Discord and click Start verification again.", 401);
    const entry = await this.entries.findOne({ _id: digest(this.config.secret, "discord-entry", ticket),
      guildId: this.config.guildId, expiresAt: { $gt: this.clock() } });
    if (!entry) throw new CommunityError("entry", "Your link expired. Return to Discord and click Start verification again.", 401);
    return entry.discordId;
  }
  async handle(interaction: ButtonInteraction, reserve: (key: string, max: number, seconds: number, now: Date) => Promise<boolean>) {
    const now = this.clock(); const discordId = interaction.member.user.id;
    // Dedupe Discord retries before creating any entry or replacing a private reply.
    if (!await reserve(digest(this.config.secret, "interaction", interaction.id), 1, 600, now)) return;
    if (!await reserve(digest(this.config.secret, "interaction-member", this.config.guildId, discordId), 10, 60, now)) {
      await this.edit(interaction.token, { content: "Please wait a minute before trying again.", allowed_mentions: { parse: [] } }); return;
    }
    await this.indexes();
    let status;
    try { status = await this.current(discordId); }
    catch { status = { content: "**Status temporarily unavailable**\nClick Check status to try again shortly.", complete: false }; }
    let url: string | undefined;
    if (!status.complete) {
      const ticket = randomToken();
      await this.entries.insertOne({ _id: digest(this.config.secret, "discord-entry", ticket), discordId,
        guildId: this.config.guildId, expiresAt: new Date(now.getTime() + FLOW_MS) });
      const link = new URL("/api/discord/entry", this.config.origin); link.searchParams.set("ticket", ticket); url = link.href;
    }
    const components = privateComponents(status.complete, url);
    const watch: Watch = { _id: `${this.config.guildId}:${discordId}`, guildId: this.config.guildId, discordId,
      interactionId: interaction.id, encryptedToken: sealInteractionToken(interaction.token, this.config.secret),
      expiresAt: new Date(now.getTime() + 14 * 60_000), nextAt: new Date(now.getTime() + 30_000), components };
    await this.watches.replaceOne({ _id: watch._id }, watch, { upsert: true });
    const response = await this.edit(interaction.token, { content: status.content, components, allowed_mentions: { parse: [] } });
    if (response.ok) await this.watches.updateOne({ _id: watch._id, interactionId: watch.interactionId },
      { $set: { lastContent: status.content, presentationVersion: 2, ...(status.complete ? { nextAt: watch.expiresAt } : {}) } });
  }
  private edit(token: string, body: unknown) {
    // Only edit the private original reply. Never fall back to a public channel message.
    return this.request(`/webhooks/${this.config.clientId}/${encodeURIComponent(token)}/messages/@original`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async processDue(deadline = new Date(this.clock().getTime() + 20_000), discordId?: string) {
    const now = this.clock();
    const due = await this.watches.find({ guildId: this.config.guildId, ...(discordId ? { discordId } : { nextAt: { $lte: now } }),
      expiresAt: { $gt: now } }).limit(3).toArray();
    for (const watch of due) {
      if (this.clock().getTime() + 7500 > deadline.getTime()) break;
      const token = randomUUID();
      let locked;
      try { locked = await this.watches.findOneAndUpdate({ _id: watch._id, interactionId: watch.interactionId,
        $or: [{ lease: { $exists: false } }, { "lease.expiresAt": { $lte: this.clock() } }] },
      { $set: { lease: { token, expiresAt: new Date(this.clock().getTime() + 15_000) } } }, { returnDocument: "after" }); }
      catch (error) { if (!(error instanceof MongoServerError)) throw error; continue; }
      if (!locked) continue;
      let nextAt = new Date(this.clock().getTime() + 30_000); let lastContent = locked.lastContent;
      let presentationVersion = locked.presentationVersion;
      try {
        const status = await this.current(watch.discordId);
        if (status.content !== lastContent || presentationVersion !== 2) {
          const savedUrl = locked.components[0]?.components.find(button => button.style === 5)?.url;
          const response = await this.edit(openInteractionToken(locked.encryptedToken, this.config.secret),
            { content: status.content, components: privateComponents(status.complete, typeof savedUrl === "string" ? savedUrl : undefined), allowed_mentions: { parse: [] } });
          if (response.ok) { lastContent = status.content; presentationVersion = 2; }
          else if (response.status === 404 || response.status === 401) nextAt = locked.expiresAt;
          else if (response.status === 429) nextAt = new Date(this.clock().getTime() + Math.max(30, Number(response.headers.get("retry-after")) || 30) * 1000);
        }
        if (status.complete && lastContent === status.content) nextAt = locked.expiresAt;
      } catch { /* A failed private update never changes access or publishes a public fallback. */ }
      await this.watches.updateOne({ _id: watch._id, interactionId: watch.interactionId, "lease.token": token },
        { $set: { nextAt, ...(lastContent ? { lastContent } : {}), ...(presentationVersion ? { presentationVersion } : {}) }, $unset: { lease: "" } });
    }
  }
}
