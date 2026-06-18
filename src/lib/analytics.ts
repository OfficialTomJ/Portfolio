import "server-only";
import { getDb } from "./mongodb";
import { getEpisodes } from "./blueprint";

// First-party funnel metrics for the /admin dashboard. Most numbers are derived
// from existing collections (user, progress, certificates, comments, likes);
// only resource downloads need their own event (see recordEvent).

export interface Overview {
  members: number;
  verified: number;
  signups7d: number;
  signups30d: number;
  completions: number;
  completionRate: number; // % of verified members who earned a certificate
}

export interface DayCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface EpisodeFunnelRow {
  slug: string;
  title: string;
  episodeNumber: number;
  started: number;
  completed: number;
}

export interface EngagementTotals {
  comments: number;
  likes: number;
  resourceDownloads: number;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function getOverview(): Promise<Overview> {
  const db = getDb();
  const users = db.collection("user");
  const [members, verified, signups7d, signups30d, completions] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ emailVerified: true }),
    users.countDocuments({ createdAt: { $gte: daysAgo(7) } }),
    users.countDocuments({ createdAt: { $gte: daysAgo(30) } }),
    db.collection("certificates").countDocuments({}),
  ]);
  const completionRate = verified > 0 ? Math.round((completions / verified) * 100) : 0;
  return { members, verified, signups7d, signups30d, completions, completionRate };
}

/** Daily counts over the last `days`, gap-filled with zeros (oldest first). */
async function dailySeries(
  collection: string,
  field: string,
  days: number
): Promise<DayCount[]> {
  const since = daysAgo(days - 1);
  since.setHours(0, 0, 0, 0);
  const rows = await getDb()
    .collection(collection)
    .aggregate<{ _id: string; count: number }>([
      { $match: { [field]: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}` } },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const counts = new Map(rows.map((r) => [r._id, r.count]));
  const out: DayCount[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

export function getSignupSeries(days = 30): Promise<DayCount[]> {
  return dailySeries("user", "createdAt", days);
}

export function getCertificateSeries(days = 30): Promise<DayCount[]> {
  return dailySeries("certificates", "issuedAt", days);
}

/** Per video episode (in season order): how many users started vs completed it. */
export async function getEpisodeFunnel(): Promise<EpisodeFunnelRow[]> {
  const episodes = (await getEpisodes()).filter((e) => e.type === "video");
  const rows = await getDb()
    .collection("progress")
    .aggregate<{ _id: string; started: number; completed: number }>([
      {
        $group: {
          _id: "$episodeSlug",
          started: { $sum: { $cond: [{ $gt: ["$percent", 0] }, 1, 0] } },
          completed: { $sum: { $cond: ["$completed", 1, 0] } },
        },
      },
    ])
    .toArray();
  const bySlug = new Map(rows.map((r) => [r._id, r]));
  return episodes.map((ep) => ({
    slug: ep.slug,
    title: ep.title,
    episodeNumber: ep.episodeNumber,
    started: bySlug.get(ep.slug)?.started ?? 0,
    completed: bySlug.get(ep.slug)?.completed ?? 0,
  }));
}

export async function getEngagementTotals(): Promise<EngagementTotals> {
  const db = getDb();
  const [comments, likes, resourceDownloads] = await Promise.all([
    db.collection("comments").countDocuments({ deleted: { $ne: true } }),
    db.collection("episodeLikes").countDocuments({}),
    db.collection("events").countDocuments({ type: "resource_download" }),
  ]);
  return { comments, likes, resourceDownloads };
}

// --- Event recording (only for metrics not already captured elsewhere) ---

let indexed = false;
async function ensureIndex() {
  if (indexed) return;
  await getDb().collection("events").createIndex({ type: 1, ts: -1 });
  indexed = true;
}

/** Fire-and-forget event write. Never throws — tracking must not break a request. */
export async function recordEvent(
  type: string,
  data: { userId?: string; props?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    await ensureIndex();
    await getDb().collection("events").insertOne({
      type,
      userId: data.userId,
      props: data.props,
      ts: new Date(),
    });
  } catch {
    /* fail-soft */
  }
}
