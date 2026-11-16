import { z } from "zod";

export const marketAssets = ["BTC", "ETH", "SOL", "HYPE"] as const;
export type MarketAsset = typeof marketAssets[number];
export interface MarketQuote { asset: MarketAsset; price: number; at: string; currency: "USD" }
export interface MarketPrices { quotes: Partial<Record<MarketAsset, MarketQuote>>; status: "connecting" | "live" | "delayed" | "paused" }
export const MARKET_STALE_MS = 120_000;
const messageSchema = z.object({ channel: z.literal("ticker"), type: z.enum(["snapshot", "update"]), data: z.array(z.object({ symbol: z.string(), last: z.number().finite().positive(), timestamp: z.iso.datetime({ offset: true }) }).strip()) }).strip();

/** Public unit prices only; reject other currencies, malformed prices and unsolicited assets. */
export function parseMarketQuotes(message: unknown, requested: readonly string[], now = Date.now()): MarketQuote[] {
  const parsed = messageSchema.safeParse(message);
  if (!parsed.success) return [];
  return parsed.data.data.flatMap(row => {
    const asset = marketAssets.find(asset => row.symbol === `${asset}/USD` && requested.includes(asset));
    const time = Date.parse(row.timestamp);
    return asset && Number.isFinite(time) && time <= now + 60_000 ? [{ asset, price: row.last, at: new Date(time).toISOString(), currency: "USD" as const }] : [];
  });
}

export interface MarketSocket extends EventTarget { readyState: number; send(data: string): void; close(): void }

/** Public ticker subscription, independent of private Kraken account/trade ingestion. */
export function watchMarketPrices(assets: readonly string[], onState: (state: MarketPrices) => void, createSocket: () => MarketSocket = () => new WebSocket("wss://ws.kraken.com/v2")) {
  const requested = marketAssets.filter(asset => assets.includes(asset));
  let state: MarketPrices = { quotes: {}, status: "connecting" };
  let stopped = false, active = true, socket: MarketSocket | undefined, receivedQuote = false, rejected = false;
  let retry: ReturnType<typeof setTimeout> | undefined, flush: ReturnType<typeof setTimeout> | undefined;
  let backoff = 2000, connectedAt = 0, lastMessageAt = 0, lastPingAt = 0;
  const emit = () => { if (!stopped) onState({ ...state, quotes: { ...state.quotes } }); };
  const quality = (): MarketPrices["status"] => !active ? "paused" : rejected || retry ? "delayed" : socket?.readyState !== 1 || !receivedQuote ? Object.keys(state.quotes).length ? "delayed" : "connecting" : requested.every(asset => state.quotes[asset] && Date.now() - Date.parse(state.quotes[asset]!.at) <= MARKET_STALE_MS) ? "live" : "delayed";
  const updateStatus = () => { const status = quality(); if (status !== state.status) { state = { ...state, status }; emit(); } };
  const disconnect = () => { const previous = socket; socket = undefined; receivedQuote = false; previous?.close(); };
  const reconnect = () => {
    if (stopped || !active || retry) return;
    state = { ...state, status: "delayed" }; emit();
    retry = setTimeout(() => { retry = undefined; connect(); }, backoff);
    backoff = Math.min(30_000, backoff * 2);
  };
  const connect = () => {
    if (stopped || !active || !requested.length || socket) return;
    connectedAt = Date.now(); lastMessageAt = connectedAt; receivedQuote = false; rejected = false;
    let current: MarketSocket;
    try { current = createSocket(); socket = current; } catch { reconnect(); return; }
    current.addEventListener("open", () => {
      if (socket !== current || stopped || !active) return;
      lastMessageAt = Date.now(); lastPingAt = Date.now();
      current.send(JSON.stringify({ method: "subscribe", params: { channel: "ticker", symbol: requested.map(asset => `${asset}/USD`), snapshot: true } }));
    });
    current.addEventListener("message", event => {
      if (socket !== current || stopped || !active) return;
      let message: unknown;
      try { message = JSON.parse(String((event as MessageEvent).data)); } catch { return; }
      lastMessageAt = Date.now();
      if (typeof message === "object" && message !== null && "method" in message && message.method === "subscribe" && "success" in message && message.success === false) { rejected = true; updateStatus(); return; }
      const quotes = parseMarketQuotes(message, requested);
      if (!quotes.length) return;
      const next = { ...state.quotes };
      for (const quote of quotes) if (!next[quote.asset] || Date.parse(quote.at) >= Date.parse(next[quote.asset]!.at)) next[quote.asset] = quote;
      state = { ...state, quotes: next }; receivedQuote = true; backoff = 2000;
      state.status = quality();
      // Coalesce busy trade streams without rerendering the performance chart.
      if (!flush) flush = setTimeout(() => { flush = undefined; emit(); }, 200);
    });
    current.addEventListener("close", () => { if (socket === current) { socket = undefined; receivedQuote = false; reconnect(); } });
    current.addEventListener("error", () => { if (socket === current) { disconnect(); reconnect(); } });
  };
  const monitor = setInterval(() => {
    if (stopped || !active) return;
    const now = Date.now();
    if (socket && ((socket.readyState === 0 && now - connectedAt > 10_000) || (socket.readyState === 1 && now - lastMessageAt > 45_000))) { disconnect(); reconnect(); return; }
    if (socket?.readyState === 1 && now - lastPingAt >= 25_000) { socket.send(JSON.stringify({ method: "ping" })); lastPingAt = now; }
    updateStatus();
  }, 5000);
  connect();
  return {
    pause: () => { active = false; if (retry) clearTimeout(retry); retry = undefined; if (flush) clearTimeout(flush); flush = undefined; disconnect(); updateStatus(); },
    resume: () => { if (!stopped) { active = true; connect(); updateStatus(); } },
    stop: () => { stopped = true; active = false; clearInterval(monitor); if (retry) clearTimeout(retry); if (flush) clearTimeout(flush); disconnect(); },
  };
}
