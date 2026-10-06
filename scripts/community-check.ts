import dotenv from "dotenv";
import { communityConfig } from "../src/lib/community/config";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

async function main() {
  const names = ["COMMUNITY_ENV", "COMMUNITY_VERIFICATION_SECRET", "COMMUNITY_PROCESS_SECRET", "COMMUNITY_TEST_RECIPIENTS", "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET", "DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID", "DISCORD_VERIFIED_ROLE_ID", "DISCORD_REDIRECT_URI",
    "DISCORD_INVITE_URL", "RESEND_API_KEY", "RESEND_CONTACTS_API_KEY", "RESEND_COMMUNITY_SEGMENT_ID", "EMAIL_FROM", "MONGODB_URI"];
  for (const name of names) console.log(`${name}: ${process.env[name]?.trim() ? "configured" : "MISSING"}`);
  const config = communityConfig({ ...process.env, COMMUNITY_VERIFICATION_ENABLED: "true" });
  console.log(`Configuration valid (${config.mode}); feature ${process.env.COMMUNITY_VERIFICATION_ENABLED === "true" ? "enabled" : "disabled"}.`);
  if ((process.env.COMMUNITY_PROCESS_SECRET?.length ?? 0) < 32) console.log("Recovery endpoint is unavailable until COMMUNITY_PROCESS_SECRET has at least 32 characters.");
  if (!process.argv.includes("--live")) return;
  async function read(url: string, token: string) {
    const response = await fetch(url, { headers: { Authorization: token }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Read-only setup check failed: HTTP ${response.status}. Check credentials and resource IDs.`);
    return response.json();
  }
  const api = "https://discord.com/api/v10";
  const bot = await read(`${api}/users/@me`, `Bot ${config.botToken}`);
  if (!bot.bot || bot.id !== config.clientId) throw new Error("Bot token does not belong to the configured Discord application.");
  const roles: { id: string; name: string; position: number; permissions: string; managed: boolean }[] = await read(`${api}/guilds/${config.guildId}/roles`, `Bot ${config.botToken}`);
  const member: { roles: string[] } = await read(`${api}/guilds/${config.guildId}/members/${bot.id}`, `Bot ${config.botToken}`);
  const verified = roles.find((role) => role.id === config.roleId);
  const botRoles = roles.filter((role) => member.roles.includes(role.id) || role.id === config.guildId);
  const permissions = botRoles.reduce((total, role) => total | BigInt(role.permissions), BigInt(0));
  if (!verified || verified.managed || verified.id === config.guildId) throw new Error("Choose a regular Verified role, not @everyone or a managed role.");
  const dangerous = ["2", "4", "8", "16", "32", "268435456", "536870912", "1099511627776"]
    .reduce((total, permission) => total | BigInt(permission), BigInt(0));
  if (BigInt(verified.permissions) & dangerous) throw new Error("Verified must not grant moderation or administrative permissions.");
  if (!(permissions & BigInt(268435456))) throw new Error("The bot needs Manage Roles.");
  if (permissions & BigInt(8)) throw new Error("Remove Administrator from the pilot bot; Manage Roles is sufficient.");
  if (Math.max(...botRoles.map((role) => role.position)) <= verified.position) throw new Error("Move the bot's role above Verified.");
  console.log(`Discord bot membership, application identity and role hierarchy passed for server ${config.guildId}.`);
  const segment = await read(`https://api.resend.com/segments/${encodeURIComponent(config.segmentId)}`, `Bearer ${config.contactsKey}`);
  if (segment.id !== config.segmentId) throw new Error("Resend segment did not match configuration.");
  console.log("Resend contact-management key and segment passed. No email sent or contact changed.");
  console.log("Still verify channel restrictions with an ordinary member and register the exact OAuth callback in the Developer Portal.");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Setup check failed."); process.exitCode = 1; });
