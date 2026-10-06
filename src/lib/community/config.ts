import { CommunityError } from "./model";
export function communityConfig(env: Record<string, string | undefined> = process.env) {
  if (env.COMMUNITY_VERIFICATION_ENABLED !== "true") throw new CommunityError("disabled", "Community verification is not available yet.", 503);
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new CommunityError("configuration", "Community verification is being configured. Please try again later.", 503);
    return value;
  };
  const mode = required("COMMUNITY_ENV");
  if (mode !== "test" && mode !== "production") throw new CommunityError("configuration", "Invalid community environment.", 503);
  if (env.VERCEL_ENV === "preview" && mode !== "test") throw new CommunityError("configuration", "Preview must use a test community.", 503);
  const guildId = required("DISCORD_GUILD_ID");
  const roleId = required("DISCORD_VERIFIED_ROLE_ID");
  const clientId = required("DISCORD_CLIENT_ID");
  if (![guildId, roleId, clientId].every((id) => /^\d{17,22}$/.test(id))) throw new CommunityError("configuration", "Discord IDs are not configured correctly.", 503);
  const secret = required("COMMUNITY_VERIFICATION_SECRET");
  if (secret.length < 32) throw new CommunityError("configuration", "Community secret must contain at least 32 characters.", 503);
  const redirect = new URL(required("DISCORD_REDIRECT_URI"));
  if (redirect.pathname !== "/api/discord/connect/callback" || redirect.search || redirect.hash ||
    redirect.protocol !== "https:" && !(env.NODE_ENV !== "production" && redirect.protocol === "http:" && redirect.hostname === "localhost")) {
    throw new CommunityError("configuration", "Discord callback must use the configured secure Mentor URL.", 503);
  }
  const testRecipients = mode === "test" ? required("COMMUNITY_TEST_RECIPIENTS").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean) : undefined;
  if (mode === "test" && env.COMMUNITY_PRODUCTION_GUILD_ID === guildId) throw new CommunityError("configuration", "Test mode cannot use the production guild.", 503);
  const invite = new URL(required("DISCORD_INVITE_URL"));
  if (invite.protocol !== "https:" || !["discord.gg", "discord.com"].includes(invite.hostname)) {
    throw new CommunityError("configuration", "Configure a Discord invitation URL.", 503);
  }
  return { mode, secret, clientId, clientSecret: required("DISCORD_CLIENT_SECRET"), botToken: required("DISCORD_BOT_TOKEN"),
    guildId, roleId, segmentId: required("RESEND_COMMUNITY_SEGMENT_ID"),
    contactsKey: required("RESEND_CONTACTS_API_KEY"), emailKey: required("RESEND_API_KEY"),
    sender: required("EMAIL_FROM"), redirectUri: redirect.href, origin: redirect.origin, inviteUrl: invite.href, testRecipients };
}
export type CommunityConfig = ReturnType<typeof communityConfig>;
