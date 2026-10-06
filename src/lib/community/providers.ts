import { z } from "zod";
import { communityEmail } from "./email";
import type { CommunityConfig } from "./config";
import type { Providers } from "./model";
import { ProviderError } from "./service";

const discord = "https://discord.com/api/v10";
const resend = "https://api.resend.com";
const identitySchema = z.object({ id: z.string().regex(/^\d{17,22}$/), username: z.string(), global_name: z.string().nullable().optional() });
const contactSchema = z.object({ id: z.string(), unsubscribed: z.boolean() });

export function providerFailure(response: Response, provider: "Discord" | "Resend") {
  const delay = Number(response.headers.get("retry-after"));
  return new ProviderError(response.status === 429 ? `${provider} is busy. Activation will retry shortly.`
    : response.status === 401 || response.status === 403 ? `${provider} permissions need attention. Contact support.`
    : response.status === 404 && provider === "Discord" ? "Join the configured community in Discord, then start verification again."
    : `${provider} activation is delayed. Please retry shortly.`,
  response.status === 429 || response.status >= 500 || response.status === 404 && provider === "Discord",
  Number.isFinite(delay) && delay > 0 ? Math.ceil(delay) : 60);
}

export function liveProviders(config: CommunityConfig, fetcher: typeof fetch = fetch): Providers {
  async function request(url: string, init: RequestInit) {
    try { return await fetcher(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) }); }
    catch { throw new ProviderError("Activation is delayed by a connection problem. Please retry shortly.", true); }
  }
  const bot = { Authorization: `Bot ${config.botToken}` };
  const contacts = { Authorization: `Bearer ${config.contactsKey}`, "Content-Type": "application/json" };
  async function contact(email: string) {
    const response = await request(`${resend}/contacts/${encodeURIComponent(email)}`, { headers: contacts });
    if (response.status === 404) return null;
    if (!response.ok) throw providerFailure(response, "Resend");
    return contactSchema.parse(await response.json());
  }
  return {
    async identity(code) {
      const response = await request(`${discord}/oauth2/token`, { method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
          grant_type: "authorization_code", code, redirect_uri: config.redirectUri }) });
      if (!response.ok) throw providerFailure(response, "Discord");
      const { access_token } = z.object({ access_token: z.string() }).parse(await response.json());
      // OAuth credentials stay in memory and are never saved to the community contact.
      const user = await request(`${discord}/users/@me`, { headers: { Authorization: `Bearer ${access_token}` } });
      if (!user.ok) throw providerFailure(user, "Discord");
      const data = identitySchema.parse(await user.json());
      return { id: data.id, name: data.global_name || data.username };
    },
    async member(guildId, discordId) {
      const response = await request(`${discord}/guilds/${guildId}/members/${discordId}`, { headers: bot });
      if (!response.ok) throw providerFailure(response, "Discord");
      return { pending: z.object({ pending: z.boolean().optional() }).parse(await response.json()).pending ?? false };
    },
    async role(guildId, discordId, roleId, action) {
      const response = await request(`${discord}/guilds/${guildId}/members/${discordId}/roles/${roleId}`,
        { method: action === "grant" ? "PUT" : "DELETE", headers: bot });
      // A departed member already has no guild access. Never treat a missing role as a successful grant.
      if (action === "remove" && response.status === 404) return;
      if (!response.ok) throw providerFailure(response, "Discord");
    },
    async email(email, code, purpose, discordName) {
      const message = communityEmail({ origin: config.origin, code, purpose, discordName });
      // Use the existing Resend sending credentials, with a bounded request and no code logging.
      const response = await request(`${resend}/emails`, { method: "POST",
        headers: { Authorization: `Bearer ${config.emailKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: config.sender, to: email,
          ...message }) });
      if (!response.ok) throw providerFailure(response, "Resend");
    },
    async subscribe(email, segmentId) {
      let existing = await contact(email);
      if (!existing) {
        const created = await request(`${resend}/contacts`, { method: "POST", headers: contacts,
          // Omit unsubscribed entirely: never overwrite a preference if another integration races creation.
          body: JSON.stringify({ email, segments: [{ id: segmentId }] }) });
        if (!created.ok && created.status !== 409) throw providerFailure(created, "Resend");
        existing = await contact(email);
        if (!existing) throw new ProviderError("Email list enrollment is delayed. Please retry shortly.", true);
      }
      const added = await request(`${resend}/contacts/${encodeURIComponent(existing.id)}/segments/${encodeURIComponent(segmentId)}`,
        { method: "POST", headers: contacts });
      if (!added.ok) throw providerFailure(added, "Resend");
      return existing;
    },
  };
}
