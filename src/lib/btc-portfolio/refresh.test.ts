import test from "node:test";
import assert from "node:assert/strict";
import { makeMockLedger } from "./fixture";
import { replayPortfolio } from "./engine";
import { fetchPortfolioSnapshot, watchPortfolio, PORTFOLIO_REFRESH_MS, PORTFOLIO_REFRESH_TIMEOUT_MS, type PortfolioRefreshResult } from "./refresh";

const first: PortfolioRefreshResult = { data: replayPortfolio(makeMockLedger()).publicData, checkedAt: "2026-01-01T12:00:00.000Z" };
const next: PortfolioRefreshResult = { data: { ...first.data, release: first.data.release + 1 }, checkedAt: "2026-01-01T12:00:15.000Z" };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("one interval refresh delivers a whole snapshot and concurrent refreshes are deduplicated", async t => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const pending: ((value: PortfolioRefreshResult) => void)[] = [], received: PortfolioRefreshResult[] = [];
  const watcher = watchPortfolio({ fetchSnapshot: () => new Promise(resolve => pending.push(resolve)), onData: result => received.push(result), onError: () => assert.fail("Unexpected refresh failure") });
  t.after(() => watcher.stop());
  assert.equal(pending.length, 1);
  await watcher.refresh(); await watcher.refresh();
  assert.equal(pending.length, 1);
  pending[0](first); await flush();
  assert.deepEqual(received, [first]);
  t.mock.timers.tick(PORTFOLIO_REFRESH_MS); assert.equal(pending.length, 2);
  pending[1](next); await flush();
  assert.deepEqual(received, [first, next]);
});

test("a failed refresh retains the last successful snapshot and timestamp, then recovers", async t => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  let calls = 0, errors = 0, current: PortfolioRefreshResult | undefined;
  const watcher = watchPortfolio({ fetchSnapshot: async () => { calls++; if (calls === 2) throw new Error("Temporary outage"); return calls === 1 ? first : next; }, onData: result => { current = result; }, onError: () => { errors++; } });
  t.after(() => watcher.stop());
  await flush(); assert.equal(current, first);
  t.mock.timers.tick(PORTFOLIO_REFRESH_MS); await flush();
  assert.equal(current, first); assert.equal(errors, 1);
  t.mock.timers.tick(PORTFOLIO_REFRESH_MS); await flush();
  assert.equal(current, next);
});

test("timeouts abort stalled refreshes, allow recovery, and discard late responses", async t => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  let calls = 0, errors = 0, late!: (value: PortfolioRefreshResult) => void;
  let signal: AbortSignal | undefined;
  const received: PortfolioRefreshResult[] = [];
  const watcher = watchPortfolio({ fetchSnapshot: current => { calls++; if (calls > 1) return Promise.resolve(next); signal = current; return new Promise(resolve => { late = resolve; }); }, onData: result => received.push(result), onError: () => { errors++; } });
  t.after(() => watcher.stop());
  t.mock.timers.tick(PORTFOLIO_REFRESH_TIMEOUT_MS); await flush();
  assert.equal(signal?.aborted, true); assert.equal(errors, 1);
  t.mock.timers.tick(PORTFOLIO_REFRESH_MS - PORTFOLIO_REFRESH_TIMEOUT_MS); await flush();
  assert.deepEqual(received, [next]);
  late(first); await flush(); assert.deepEqual(received, [next]);
});

test("hidden or offline views pause requests; stopping cancels work and prevents late updates", async t => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  let active = false, calls = 0, late!: (value: PortfolioRefreshResult) => void;
  let signal: AbortSignal | undefined;
  const watcher = watchPortfolio({ isActive: () => active, fetchSnapshot: current => { calls++; signal = current; return new Promise(resolve => { late = resolve; }); }, onData: () => assert.fail("Stopped watcher delivered data"), onError: () => assert.fail("Cancellation reported as an error") });
  t.after(() => watcher.stop());
  t.mock.timers.tick(PORTFOLIO_REFRESH_MS); assert.equal(calls, 0);
  active = true; const request = watcher.refresh(); assert.equal(calls, 1);
  watcher.stop(); assert.equal(signal?.aborted, true);
  late(first); await request;
  t.mock.timers.tick(PORTFOLIO_REFRESH_MS * 4); await flush(); assert.equal(calls, 1);
});

test("public refreshes bypass caches, validate payloads and preserve the public allowlist", async () => {
  const signal = new AbortController().signal;
  const result = await fetchPortfolioSnapshot(signal, async (url, options) => {
    assert.equal(url, "/api/btc-portfolio"); assert.equal(options?.cache, "no-store"); assert.equal(options?.credentials, "omit"); assert.equal(options?.signal, signal);
    return Response.json({ ...first.data, quantity: "PRIVATE_SENTINEL" }, { headers: { "X-Portfolio-Checked-At": first.checkedAt } });
  });
  assert.equal(result.checkedAt, first.checkedAt); assert.ok(!JSON.stringify(result).includes("PRIVATE_SENTINEL"));
  await assert.rejects(fetchPortfolioSnapshot(signal, async () => Response.json({ error: "Unavailable" }, { status: 503 })));
  await assert.rejects(fetchPortfolioSnapshot(signal, async () => Response.json({ ...first.data, points: [{ at: "invalid" }] })));
});
