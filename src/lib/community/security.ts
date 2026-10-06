import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CommunityError, type Flow } from "./model";

export function randomToken() { return randomBytes(32).toString("base64url"); }
export function randomCode() { return randomInt(0, 1_000_000).toString().padStart(6, "0"); }
export function digest(secret: string, ...values: string[]) {
  return createHmac("sha256", secret).update(JSON.stringify(values)).digest("hex");
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function normalizeEmail(input: string) {
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !z.email().safeParse(email).success) {
    throw new CommunityError("email", "Enter a valid email address.");
  }
  return email;
}
export function codeDigest(secret: string, flow: Flow, email: string, code: string) {
  return digest(secret, "code", flow._id, flow.purpose, email, flow.discord?.id ?? "", code);
}
export function checkOrigin(origin: string | null, expectedOrigin: string) {
  if (origin !== expectedOrigin) throw new CommunityError("origin", "Request not allowed.", 403);
}
