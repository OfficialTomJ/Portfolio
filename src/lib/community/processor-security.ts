import { CommunityError } from "./model";
import { equal } from "./security";

export function authorizeProcessor(headers: Headers, secret: string | undefined) {
  // Dedicated to Discord; the journal's CRON_SECRET cannot authorize this endpoint.
  if (!secret || secret.length < 32 || !equal(headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    throw new CommunityError("processor_auth", "Unauthorized", 401);
  }
}
export function checkProcessorTarget(headers: Headers, target: { mode: string; guildId: string }) {
  if (headers.get("x-community-environment") !== target.mode || headers.get("x-community-guild") !== target.guildId) {
    throw new CommunityError("processor_target", "Recovery target does not match the configured environment and server.", 409);
  }
}
