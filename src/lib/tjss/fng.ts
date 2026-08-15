import "server-only";
import { getDb } from "../mongodb";
import { Classification, FngPoint, classify } from "./types";

// Real Crypto Fear & Greed Index from Alternative.me (free, no API key).
// Full daily history goes back to 2018-02-01. We cache the whole series in a
// single Mongo doc and refresh when it's older than REFRESH_MS.

const DAY = 86400;
// 1h, matching price.ts. The index itself only publishes once a day, but the
// cache has to be CHECKED more often than the data changes, not less: a 6h TTL
// meant that after each new UTC day began, price (1h TTL) had already pulled the
// new day's candle while F&G was still up to six hours behind. The newest bar
// then carried a price and no sentiment, and the dashboard reported "awaiting
// Fear & Greed data" for hours every single day.
const REFRESH_MS = 60 * 60 * 1000; // 1h
const API = "https://api.alternative.me/fng/?limit=0&format=json";
const COLLECTION = "tjss_fng";
const DOC_ID = "history";

interface CacheDoc {
  _id: string;
  points: FngPoint[];
  fetchedAt: Date;
}

interface AltMeRow {
  value: string;
  value_classification: string;
  timestamp: string;
}

function normalize(rows: AltMeRow[]): FngPoint[] {
  const points: FngPoint[] = rows.map((r) => {
    const ts = Number(r.timestamp);
    const time = Math.floor(ts / DAY) * DAY; // snap to UTC-day
    const value = Number(r.value);
    const classification =
      (r.value_classification as Classification) ?? classify(value);
    return { time, value, classification };
  });
  points.sort((a, b) => a.time - b.time);
  // De-dupe by day, keeping the last reading for that day.
  const byDay = new Map<number, FngPoint>();
  for (const p of points) byDay.set(p.time, p);
  return Array.from(byDay.values()).sort((a, b) => a.time - b.time);
}

async function fetchFromApi(): Promise<FngPoint[]> {
  const res = await fetch(API, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Alternative.me responded ${res.status}`);
  const json = (await res.json()) as { data?: AltMeRow[] };
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error("Unexpected Alternative.me payload");
  }
  return normalize(json.data);
}

/**
 * Full F&G history (ascending by day). Served from Mongo cache when fresh;
 * otherwise refetched. On a fetch failure we fall back to any cached copy so
 * the dashboard degrades gracefully instead of erroring.
 */
export async function getFngHistory(): Promise<FngPoint[]> {
  const col = getDb().collection<CacheDoc>(COLLECTION);
  const cached = await col.findOne({ _id: DOC_ID });
  const fresh =
    cached && Date.now() - new Date(cached.fetchedAt).getTime() < REFRESH_MS;
  if (fresh) return cached!.points;

  try {
    const points = await fetchFromApi();
    await col.updateOne(
      { _id: DOC_ID },
      { $set: { points, fetchedAt: new Date() } },
      { upsert: true }
    );
    return points;
  } catch (err) {
    if (cached) return cached.points; // stale is better than nothing
    throw err;
  }
}

/** Most recent F&G reading, or null if unavailable. */
export async function getLatestFng(): Promise<FngPoint | null> {
  const history = await getFngHistory();
  return history.length ? history[history.length - 1] : null;
}

/** History as a day -> value map for fast alignment with price candles. */
export function fngByDay(points: FngPoint[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const p of points) map.set(p.time, p.value);
  return map;
}
