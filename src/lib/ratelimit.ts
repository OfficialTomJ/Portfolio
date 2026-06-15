import "server-only";
import { NextResponse } from "next/server";
import { getDb } from "./mongodb";

// Simple fixed-window rate limiter backed by MongoDB (no extra infra).
// Counters auto-expire via a TTL index.

let idx = false;
async function ensureIndex() {
  if (idx) return;
  await getDb()
    .collection("rateLimits")
    .createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  idx = true;
}

/** Returns true if the action is allowed (under the limit) for this window. */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  try {
    await ensureIndex();
    const now = Date.now();
    const windowStart = Math.floor(now / (windowSec * 1000)) * (windowSec * 1000);
    const id = `${key}:${windowStart}`;
    const doc = await getDb()
      .collection<{ _id: string; count: number; expireAt: Date }>("rateLimits")
      .findOneAndUpdate(
        { _id: id },
        {
          $inc: { count: 1 },
          $setOnInsert: { expireAt: new Date(windowStart + windowSec * 1000) },
        },
        { upsert: true, returnDocument: "after" }
      );
    const count = doc?.count ?? 1;
    return count <= limit;
  } catch {
    // Fail open: never block legitimate users if the limiter errors.
    return true;
  }
}

/** Convenience: returns a 429 response if over the limit, else null. */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<NextResponse | null> {
  const ok = await rateLimit(key, limit, windowSec);
  if (ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    { status: 429 }
  );
}
