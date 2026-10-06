import dotenv from "dotenv";
import { communityConfig } from "../src/lib/community/config";
import { starterMessage } from "../src/lib/community/onboarding";
import { START_BUTTON } from "../src/lib/community/interaction-security";

dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const config = communityConfig(); const channelId = process.env.DISCORD_VERIFY_CHANNEL_ID;
  if (config.mode !== "test" || config.guildId !== "1556786037307613317" || !channelId || !/^\d{17,22}$/.test(channelId)) {
    throw new Error("This publisher is restricted to the approved test server.");
  }
  const headers = { Authorization: `Bot ${config.botToken}`, "Content-Type": "application/json" };
  async function api(path: string, init?: RequestInit) {
    const response = await fetch(`https://discord.com/api/v10${path}`, { ...init, headers, redirect: "error", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Discord entrypoint request failed: HTTP ${response.status}.`);
    return response.json();
  }
  const channel = await api(`/channels/${channelId}`);
  if (channel.guild_id !== config.guildId || channel.type !== 0) throw new Error("Choose a text channel in the test guild.");
  if (!process.argv.includes("--publish")) { console.log("Test entrypoint target validated; use --publish to create/update the permanent message."); return; }
  const messages = await api(`/channels/${channelId}/messages?limit=50`);
  const existing = messages.find((message: { id: string; author: { id: string }; components?: { components?: { custom_id?: string }[] }[] }) =>
    message.author.id === config.clientId && message.components?.some(row => row.components?.some(button => button.custom_id === START_BUTTON)));
  const message = await api(`/channels/${channelId}/messages${existing ? `/${existing.id}` : ""}`,
    { method: existing ? "PATCH" : "POST", body: JSON.stringify(starterMessage) });
  console.log(`Test entrypoint ${existing ? "updated" : "created"}: https://discord.com/channels/${config.guildId}/${channelId}/${message.id}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Test entrypoint setup failed."); process.exitCode = 1; });
