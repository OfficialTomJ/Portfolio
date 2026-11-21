import { z } from "zod";
import { MARKET_STALE_MS, type MarketAsset, type MarketQuote } from "./market-prices";

const pairs: Record<MarketAsset, string> = { BTC: "XBTUSD", ETH: "ETHUSD", SOL: "SOLUSD", HYPE: "HYPEUSD" };
const keys: Record<MarketAsset, string[]> = { BTC: ["XXBTZUSD", "XBTUSD"], ETH: ["XETHZUSD", "ETHUSD"], SOL: ["SOLUSD"], HYPE: ["HYPEUSD"] };
const tradeSchema = z.tuple([z.string(), z.string(), z.number().finite()]).rest(z.unknown());
const responseSchema = z.object({ error: z.array(z.string()).length(0), result: z.record(z.string(), z.unknown()) });

/** Public trades supply a source timestamp; response time alone cannot make an old price live. */
export async function fetchMarketQuote(asset: MarketAsset, fetcher: typeof fetch = fetch, now = Date.now): Promise<MarketQuote> {
  const response = await fetcher(`https://api.kraken.com/0/public/Trades?pair=${pairs[asset]}&count=1`, { cache: "no-store", signal: AbortSignal.timeout(4000), redirect: "error" });
  if (!response.ok) throw new Error("Market prices unavailable.");
  const body = responseSchema.parse(await response.json());
  const rows = z.array(tradeSchema).min(1).parse(keys[asset].map(key => body.result[key]).find(Array.isArray));
  const row = rows.at(-1)!, price = Number(row[0]), time = row[2] * 1000, current = now();
  if (!Number.isFinite(price) || price <= 0 || current - time > MARKET_STALE_MS || time > current + 60_000) throw new Error("Market price is stale or invalid.");
  return { asset, price, at: new Date(time).toISOString(), currency: "USD" };
}

/** Deduplicate bursts across page/API requests, with a bounded five-second market-price cache. */
export function createMarketQuoteLoader(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<MarketAsset, { expires: number; request: Promise<MarketQuote> }>();
  return (asset: MarketAsset) => {
    const existing = cache.get(asset);
    if (existing && existing.expires > now()) return existing.request;
    const request = fetchMarketQuote(asset, fetcher, now).catch(error => { if (cache.get(asset)?.request === request) cache.delete(asset); throw error; });
    cache.set(asset, { expires: now() + 5000, request });
    return request;
  };
}
