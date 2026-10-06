import { createPublicKey, verify } from "node:crypto";
import { z } from "zod";

export const START_BUTTON = "community:start:v1";
export const STATUS_BUTTON = "community:status:v1";
const snowflake = z.string().regex(/^\d{17,22}$/);
const buttonInteraction = z.object({
  type: z.literal(3), id: snowflake, application_id: snowflake,
  token: z.string().min(1).max(2048), guild_id: snowflake, channel_id: snowflake,
  member: z.object({ user: z.object({ id: snowflake }) }),
  message: z.object({ author: z.object({ id: snowflake }) }),
  data: z.object({ component_type: z.literal(2), custom_id: z.enum([START_BUTTON, STATUS_BUTTON]) }),
});
export type ButtonInteraction = z.infer<typeof buttonInteraction>;

export function validDiscordSignature(body: string, headers: Headers, publicKey: string, now = Date.now()) {
  const signature = headers.get("x-signature-ed25519") ?? "";
  const timestamp = headers.get("x-signature-timestamp") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(publicKey) || !/^[a-f0-9]{128}$/i.test(signature) || !/^\d{10,12}$/.test(timestamp)) return false;
  const age = now - Number(timestamp) * 1000;
  if (age > 300_000 || age < -60_000) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKey, "hex")]), format: "der", type: "spki" });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, "hex"));
  } catch { return false; }
}

export function parseButtonInteraction(payload: unknown, config: { clientId: string; guildId: string; channelId: string }) {
  const parsed = buttonInteraction.safeParse(payload);
  if (!parsed.success) return null;
  const i = parsed.data;
  return i.application_id === config.clientId && i.message.author.id === config.clientId &&
    i.guild_id === config.guildId && i.channel_id === config.channelId ? i : null;
}

export const privateReply = (content: string) => ({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });
export const privateDeferred = { type: 5, data: { flags: 64 } };
