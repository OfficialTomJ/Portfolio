import "server-only";
import { getDb } from "./mongodb";

export interface ProgressDoc {
  userId: string;
  episodeSlug: string;
  completed: boolean;
  percent: number;
  seconds: number;
  updatedAt: Date;
}

export interface ProgressEntry {
  completed: boolean;
  percent: number;
  seconds: number;
  updatedAt: Date;
}

let indexed = false;
async function ensureIndex() {
  if (indexed) return;
  await getDb()
    .collection("progress")
    .createIndex({ userId: 1, episodeSlug: 1 }, { unique: true });
  indexed = true;
}

/** Map of episodeSlug -> progress for one user. */
export async function getUserProgress(
  userId: string
): Promise<Record<string, ProgressEntry>> {
  const docs = await getDb()
    .collection<ProgressDoc>("progress")
    .find({ userId })
    .toArray();
  const map: Record<string, ProgressEntry> = {};
  for (const d of docs) {
    map[d.episodeSlug] = {
      completed: d.completed,
      percent: d.percent,
      seconds: d.seconds ?? 0,
      updatedAt: d.updatedAt,
    };
  }
  return map;
}

export async function upsertProgress(
  userId: string,
  episodeSlug: string,
  {
    percent,
    seconds,
    completed,
  }: { percent?: number; seconds?: number; completed?: boolean }
) {
  await ensureIndex();
  const set: Partial<ProgressDoc> = { userId, episodeSlug, updatedAt: new Date() };
  if (typeof percent === "number") {
    set.percent = Math.max(0, Math.min(100, Math.round(percent)));
  }
  if (typeof seconds === "number") {
    set.seconds = Math.max(0, Math.round(seconds));
  }
  if (typeof completed === "boolean") {
    set.completed = completed;
    if (completed) set.percent = 100;
  }
  await getDb()
    .collection<ProgressDoc>("progress")
    .updateOne({ userId, episodeSlug }, { $set: set }, { upsert: true });
}
