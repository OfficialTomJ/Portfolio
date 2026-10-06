import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";
import { communityConfig } from "../src/lib/community/config";
import { MongoCommunityRepository } from "../src/lib/community/mongo-repository";
import { liveProviders } from "../src/lib/community/providers";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  const file = value("--members");
  if (!file) throw new Error("Usage: community:grandfather -- --members reviewed-ids.json [--apply --confirm-guild GUILD_ID]");
  const input: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(input) || !input.length || input.length > 1000 || !input.every((id) => typeof id === "string" && /^\d{17,22}$/.test(id))) {
    throw new Error("Provide a reviewed JSON array of 1–1000 Discord member ID strings.");
  }
  const ids = [...new Set(input as string[])];
  const config = communityConfig(); const apply = args.includes("--apply");
  if (apply && value("--confirm-guild") !== config.guildId) throw new Error("Apply requires --confirm-guild matching the configured server.");
  // Validate the entire reviewed roster before making any change. No automatic scan of new joiners.
  for (const id of ids) {
    const response = await fetch(`https://discord.com/api/v10/guilds/${config.guildId}/members/${id}`,
      { headers: { Authorization: `Bot ${config.botToken}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Member ${id} check failed (${response.status}); no roster changes made.`);
    const member = await response.json();
    if (member.user?.bot || member.pending) throw new Error(`Member ${id} is a bot or has pending rules screening; review the roster.`);
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", environment: config.mode,
    guildId: config.guildId, verifiedRoleId: config.roleId, count: ids.length, memberIds: ids }, null, 2));
  if (!apply) { console.log("No roles, database records, accounts, contacts or emails changed."); return; }
  const client = new MongoClient(process.env.MONGODB_URI!);
  try {
    const repo = new MongoCommunityRepository(client.db(process.env.MONGODB_DB), config.mode === "test" ? "communityTest" : "community");
    const providers = liveProviders(config);
    for (const id of ids) {
      // Store access provenance first; rerunning safely resumes a partial import.
      await repo.recordTrustedMember(config.guildId, id, new Date());
      await providers.role(config.guildId, id, config.roleId, "grant");
      console.log(`Verified existing member ${id}.`);
    }
    console.log("Trusted access recorded. No email, Resend contact, or Mentor account created.");
  } finally { await client.close(); }
}
main().catch(() => { console.error("Existing-member import failed. Review the roster, configuration and provider permissions; safely rerun the same roster after a partial apply."); process.exitCode = 1; });
