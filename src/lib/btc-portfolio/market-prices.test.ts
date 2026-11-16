import test from "node:test";
import assert from "node:assert/strict";
import { parseMarketQuotes, watchMarketPrices, type MarketPrices, type MarketSocket } from "./market-prices";

const initialTime = Date.parse("2026-01-01T00:00:00Z");
const ticker = (price: number, at = new Date().toISOString(), symbol = "BTC/USD") => ({ channel: "ticker", type: "snapshot", data: [{ symbol, last: price, timestamp: at, volume: 999, quantity: "NOT_A_PORTFOLIO_BALANCE" }] });
class TestSocket extends EventTarget implements MarketSocket {
  readyState = 0;
  sent: unknown[] = [];
  send(data: string) { this.sent.push(JSON.parse(data)); }
  open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  message(message: unknown) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) })); }
  close() { this.readyState = 3; this.dispatchEvent(new Event("close")); }
}

test("market prices allow only requested USD assets and valid timestamps/prices, never source quantities", () => {
  const quotes = parseMarketQuotes(ticker(100, new Date(initialTime).toISOString()), ["BTC"], initialTime);
  assert.deepEqual(quotes, [{ asset: "BTC", price: 100, at: "2026-01-01T00:00:00.000Z", currency: "USD" }]);
  assert.ok(!JSON.stringify(quotes).includes("NOT_A_PORTFOLIO_BALANCE"));
  assert.deepEqual(parseMarketQuotes(ticker(100, new Date(initialTime).toISOString(), "BTC/EUR"), ["BTC"], initialTime), []);
  assert.deepEqual(parseMarketQuotes(ticker(100, new Date(initialTime).toISOString(), "ETH/USD"), ["BTC"], initialTime), []);
  assert.deepEqual(parseMarketQuotes(ticker(-1, new Date(initialTime).toISOString()), ["BTC"], initialTime), []);
  assert.deepEqual(parseMarketQuotes(ticker(100, "invalid"), ["BTC"], initialTime), []);
  assert.deepEqual(parseMarketQuotes(ticker(100, new Date(initialTime + 61_000).toISOString()), ["BTC"], initialTime), []);
});

test("public ticker subscriptions stream prices, reject older updates and retain values on reconnect", t => {
  t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"], now: initialTime });
  const sockets: TestSocket[] = [], states: MarketPrices[] = [];
  const watcher = watchMarketPrices(["BTC", "USD", "BTC"], state => states.push(state), () => { const socket = new TestSocket(); sockets.push(socket); return socket; });
  t.after(() => watcher.stop());
  sockets[0].open();
  assert.deepEqual(sockets[0].sent[0], { method: "subscribe", params: { channel: "ticker", symbol: ["BTC/USD"], snapshot: true } });
  sockets[0].message(ticker(100)); t.mock.timers.tick(200);
  assert.equal(states.at(-1)?.status, "live"); assert.equal(states.at(-1)?.quotes.BTC?.price, 100);
  sockets[0].message(ticker(80, new Date(initialTime - 1000).toISOString())); t.mock.timers.tick(200);
  assert.equal(states.at(-1)?.quotes.BTC?.price, 100);
  sockets[0].close(); assert.equal(states.at(-1)?.status, "delayed"); assert.equal(states.at(-1)?.quotes.BTC?.price, 100);
  sockets[0].message(ticker(999)); t.mock.timers.tick(2000); assert.equal(sockets.length, 2);
  sockets[1].open(); sockets[1].message(ticker(120)); t.mock.timers.tick(200);
  assert.equal(states.at(-1)?.status, "live"); assert.equal(states.at(-1)?.quotes.BTC?.price, 120);
});

test("heartbeat traffic does not disguise a stale price as live", t => {
  t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"], now: initialTime });
  const socket = new TestSocket(), states: MarketPrices[] = [];
  const watcher = watchMarketPrices(["BTC"], state => states.push(state), () => socket);
  t.after(() => watcher.stop());
  socket.open(); socket.message(ticker(100)); t.mock.timers.tick(200);
  for (let i = 0; i < 25; i++) { socket.message({ channel: "heartbeat" }); t.mock.timers.tick(5000); }
  assert.equal(states.at(-1)?.status, "delayed"); assert.equal(states.at(-1)?.quotes.BTC?.at, "2026-01-01T00:00:00.000Z");
  assert.ok(socket.sent.some(message => (message as { method?: string }).method === "ping"));
});

test("pausing closes the subscription; stopping removes retries and pending UI updates", t => {
  t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"], now: initialTime });
  const sockets: TestSocket[] = [], states: MarketPrices[] = [];
  const watcher = watchMarketPrices(["BTC"], state => states.push(state), () => { const socket = new TestSocket(); sockets.push(socket); return socket; });
  t.after(() => watcher.stop());
  sockets[0].open(); sockets[0].message(ticker(100)); t.mock.timers.tick(200);
  watcher.pause(); assert.equal(sockets[0].readyState, 3); assert.equal(states.at(-1)?.status, "paused");
  t.mock.timers.tick(30_000); assert.equal(sockets.length, 1);
  watcher.resume(); assert.equal(sockets.length, 2); sockets[1].open(); sockets[1].message(ticker(110));
  watcher.stop(); const count = states.length; t.mock.timers.tick(90_000);
  assert.equal(states.length, count); assert.equal(sockets.length, 2);
});

test("rejected subscriptions and unresponsive connections show delayed status", t => {
  t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"], now: initialTime });
  const sockets: TestSocket[] = [], states: MarketPrices[] = [];
  const watcher = watchMarketPrices(["HYPE"], state => states.push(state), () => { const socket = new TestSocket(); sockets.push(socket); return socket; });
  t.after(() => watcher.stop());
  sockets[0].open(); sockets[0].message({ method: "subscribe", success: false, error: "Symbol unavailable" });
  t.mock.timers.tick(5000); assert.equal(states.at(-1)?.status, "delayed");
  sockets[0].close(); t.mock.timers.tick(2000); assert.equal(sockets.length, 2);
  t.mock.timers.tick(15_000); assert.equal(sockets[1].readyState, 3); assert.equal(states.at(-1)?.status, "delayed");
});
