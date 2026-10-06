import "server-only";
import { getDb } from "../mongodb";
import { communityConfig } from "./config";
import { MongoCommunityRepository } from "./mongo-repository";
import { liveProviders } from "./providers";
import { CommunityService } from "./service";
import { CommunityWorker } from "./worker";
import { DiscordOnboarding } from "./onboarding";

const repositories = new Map<string, MongoCommunityRepository>();

export function getCommunity() {
  const config = communityConfig();
  const db = getDb(); const prefix = config.mode === "test" ? "communityTest" : "community";
  const key = `${db.databaseName}:${prefix}`;
  let repo = repositories.get(key);
  if (!repo) { repo = new MongoCommunityRepository(db, prefix); repositories.set(key, repo); }
  const service = new CommunityService(repo, liveProviders(config), config.secret,
    { guildId: config.guildId, roleId: config.roleId, segmentId: config.segmentId }, config.testRecipients);
  const onboarding = process.env.DISCORD_VERIFY_CHANNEL_ID && process.env.DISCORD_PUBLIC_KEY
    ? new DiscordOnboarding(db, prefix, config) : undefined;
  const worker = new CommunityWorker(db, prefix,
    { guildId: config.guildId, roleId: config.roleId, segmentId: config.segmentId }, {
      async processDue(options) {
        const processed = await service.processDue(options);
        // Reply delivery is independent of role/list jobs and respects the same worker budget.
        if (onboarding) await onboarding.processDue(options?.deadline);
        return processed;
      },
    });
  return { config, repo, service, worker, onboarding };
}

export async function claimCommunityContact(user: { id: string; email: string; emailVerified: boolean }) {
  if (!user.emailVerified || process.env.COMMUNITY_VERIFICATION_ENABLED !== "true") return;
  try { await getCommunity().repo.claim(user.email.trim().toLowerCase(), user.id); }
  catch { console.warn("[community] Website contact claim deferred until the profile is opened."); }
}
