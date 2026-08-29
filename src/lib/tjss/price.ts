import "server-only";
import { getDb } from "../mongodb";
import { Candle } from "./types";

// BTC daily OHLCV. Primary source is Binance klines (free, no key); the public
// data mirror (data-api.binance.vision) is used as a fallback if the main host
// is unavailable. The full series is cached in Mongo and topped up on refresh.

const DAY = 86400;
const REFRESH_MS = 60 * 60 * 1000; // 1h
const COLLECTION = "tjss_price";
const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];
const MAX_LIMIT = 1000;

interface CacheDoc {
  _id: string;
  candles: Candle[];
  fetchedAt: Date;
  /** Whether the pre-Binance (pre-2017) CoinMetrics history is actually in
   * `candles`. A transient backfill failure used to be swallowed and the
   * Binance-only series cached anyway; every later refresh then took the
   * top-up branch, so the missing years were never retried and long warm-up
   * indicators ran short forever. Absent on docs written before this flag
   * existed, which is treated as "not backfilled" so they self-heal. */
  backfilled?: boolean;
}

type Kline = [
  number, // open time (ms)
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  ...unknown[]
];

async function fetchKlines(
  symbol: string,
  interval: string,
  startTime?: number
): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(MAX_LIMIT),
  });
  if (startTime) params.set("startTime", String(startTime));

  let lastErr: unknown = null;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3/klines?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`${host} responded ${res.status}`);
      const rows = (await res.json()) as Kline[];
      return rows.map((k) => ({
        time: Math.floor(k[0] / 1000 / DAY) * DAY,
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      }));
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("All Binance hosts failed");
}

/** Page through Binance from `startTime` to now (klines cap at 1000/request). */
async function fetchAll(
  symbol: string,
  interval: string,
  startTime: number
): Promise<Candle[]> {
  const all: Candle[] = [];
  let cursor = startTime;
  // Guard against infinite loops; ~10 pages covers >27 years of daily bars.
  for (let page = 0; page < 20; page++) {
    const batch = await fetchKlines(symbol, interval, cursor);
    if (batch.length === 0) break;
    for (const c of batch) {
      if (all.length === 0 || c.time > all[all.length - 1].time) all.push(c);
    }
    if (batch.length < MAX_LIMIT) break;
    cursor = (batch[batch.length - 1].time + DAY) * 1000;
  }
  return all;
}

function mergeCandles(base: Candle[], updates: Candle[]): Candle[] {
  const byDay = new Map<number, Candle>();
  for (const c of base) byDay.set(c.time, c);
  for (const c of updates) byDay.set(c.time, c); // updates win (fresher)
  return Array.from(byDay.values()).sort((a, b) => a.time - b.time);
}

/**
 * Pre-Binance daily closes (2010-07 onward) from the free CoinMetrics
 * community API. Close-only, so each bar is synthesised flat with volume 0,
 * that marks it as backfill and keeps volume-gated rules (washouts) from
 * firing on it. Its only job is warming up the 50-week / 50-month EMAs before
 * the Fear & Greed era begins in 2018.
 */
async function fetchBackfill(): Promise<Candle[]> {
  const url =
    "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics" +
    "?assets=btc&metrics=PriceUSD&frequency=1d&page_size=10000" +
    "&start_time=2010-01-01&end_time=2030-12-31";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinMetrics responded ${res.status}`);
  const json = (await res.json()) as { data?: { time: string; PriceUSD?: string }[] };
  if (!json.data) throw new Error("Unexpected CoinMetrics payload");
  return json.data
    .filter((r) => r.PriceUSD)
    .map((r) => {
      const close = Number(r.PriceUSD);
      return {
        time: Math.floor(Date.parse(r.time) / 1000 / DAY) * DAY,
        open: close, high: close, low: close, close, volume: 0,
      };
    });
}

/**
 * Full BTC daily candle history (ascending). Cached in Mongo; on refresh we
 * only pull recent klines and merge. Falls back to cache on network failure.
 */
export async function getDailyCandles(
  symbol = "BTCUSDT"
): Promise<Candle[]> {
  const col = getDb().collection<CacheDoc>(COLLECTION);
  const id = `${symbol}_1d`;
  const cached = await col.findOne({ _id: id });
  const fresh =
    cached && Date.now() - new Date(cached.fetchedAt).getTime() < REFRESH_MS;
  if (fresh && cached) return cached.candles;

  /** Never throws: a missing backfill degrades the series, it must not fail
   *  the request. Returns null so the caller can leave `backfilled` false and
   *  try again on the next refresh. */
  const tryBackfill = async (): Promise<Candle[] | null> => {
    try {
      return await fetchBackfill();
    } catch (err) {
      console.warn("[tjss/price] backfill unavailable, continuing without pre-2017 history", err);
      return null;
    }
  };

  try {
    let candles: Candle[];
    let backfilled: boolean;
    if (cached && cached.candles.length > 0) {
      // Top up from a few days before the last cached bar.
      const last = cached.candles[cached.candles.length - 1].time;
      const recent = await fetchKlines(
        symbol,
        "1d",
        (last - 5 * DAY) * 1000
      );
      candles = mergeCandles(cached.candles, recent);
      backfilled = cached.backfilled === true;
      // A refresh is also the retry: if an earlier cold start lost the
      // pre-2017 history, fetch it now rather than carrying the gap forever.
      if (!backfilled) {
        const backfill = await tryBackfill();
        if (backfill) {
          // Binance (real OHLCV) wins wherever it exists.
          candles = mergeCandles(backfill, candles);
          backfilled = true;
        }
      }
    } else {
      // Cold start: Binance BTCUSDT begins 2017-08-17; backfill the years
      // before it so the weekly/monthly 50 EMAs are warm by the F&G era.
      const start = Date.UTC(2017, 7, 17);
      const binance = await fetchAll(symbol, "1d", start);
      const backfill = await tryBackfill();
      candles = mergeCandles(backfill ?? [], binance);
      backfilled = backfill !== null;
    }
    await col.updateOne(
      { _id: id },
      { $set: { candles, fetchedAt: new Date(), backfilled } },
      { upsert: true }
    );
    return candles;
  } catch (err) {
    if (cached && cached.candles.length > 0) return cached.candles;
    throw err;
  }
}
