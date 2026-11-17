import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newEvent, replayPortfolio } from "./engine";
import { makeMockLedger } from "./fixture";
import { applyCommand, initialWorkspace, fingerprint } from "./model";
import { commandSchema, eventSchema, publicSchema, type Ledger, type PortfolioEvent, type PublicPortfolio } from "./schema";
import { activityAllocationChanges, date, portfolioUpdateTime, metrics, periodPoints, utcMidnight, portfolioActivityView } from "./view";
import { importExample, parseImport } from "./bulk";

const dates = ["2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"];
function event(kind: PortfolioEvent["kind"], n: number, extra: Partial<PortfolioEvent> = {}): PortfolioEvent {
  return { ...newEvent(dates[n]), id: randomUUID(), kind, account: "margin", asset: "BTC", price: "100", quantity: "1", publicReason: "Fictional allocation decision.", ...extra };
}
function ledger(prices = [100, 100, 100]): Ledger {
  return { mode: "mock", currency: "USDT", inceptionAt: dates[0], asOf: dates[2], campaigns: [], marks: prices.map((price, i) => ({ at: dates[i], asset: "BTC", price: String(price) })), events: [event("opening", 0)] };
}
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const result = (d: Ledger) => replayPortfolio(d);

test("unlevered BTC follows BTC and maintains zero BTC-relative performance", () => {
  const r = result(ledger([100, 90, 120])); const m = metrics(r.publicData.points)!;
  near(m.portfolio, 20); near(m.btc, 20); near(m.relative, 0); near(m.drawdown, -10);
});
test("external fiat and in-kind BTC funding cannot manufacture returns", () => {
  const d = ledger(); d.events.push(event("deposit", 1, { asset: "USDT", price: "1", quantity: "200" }), event("deposit", 2, { quantity: "2" }));
  const r = result(d); near(metrics(r.publicData.points)!.portfolio, 0); near(Number(r.summary.netContributions), 400); near(Number(r.summary.pnl), 0); near(Number(r.summary.passiveBtc), 5); near(Number(r.summary.passiveGap), 0);
});
test("partial withdrawal is unitized; withdrawal fee is a real loss", () => {
  const d = ledger(); d.events.push(event("withdrawal", 1, { quantity: "0.5", fee: "0.01", feeAsset: "BTC" }));
  const r = result(d); near(metrics(r.publicData.points)!.portfolio, -2); near(Number(r.summary.pnl), -1);
});
test("internal transfer conserves value and BTC, with fee debited once", () => {
  const d = ledger(); d.events.push(event("transfer", 1, { quantity: "0.4", fee: "0.001", feeAsset: "BTC" }));
  const r = result(d); near(Number(r.summary.btcHeld), .999); near(Number(r.summary.netContributions), 0); near(metrics(r.publicData.points)!.portfolio, -.1);
  near(Number(r.summary.holdings.find(h => h.account === "cold")!.quantity), .4);
});
test("margin notional and entry collateral do not inflate equity; exposure can exceed 100%", () => {
  const d = ledger(); d.events.push(event("opening", 0, { asset: "USDT", price: "1", quantity: "1000" }), event("margin-open", 1, { quantity: "20", positionId: "p", leverage: 3 }));
  const r = result(d); near(Number(r.summary.equity), 1100); near(metrics(r.publicData.points)!.portfolio, 0);
  assert.ok(r.publicData.investedPct > 190); near(r.publicData.cashPct, 1000 / 1100 * 100);
});
test("long margin PnL and financing reconcile independently of exposure", () => {
  const d = ledger([100, 100, 120]); d.events.push(event("opening", 0, { asset: "USDT", price: "1", quantity: "1000" }), event("margin-open", 1, { quantity: "5", positionId: "p", fee: "2" }), event("fee", 2, { asset: "USDT", price: "1", quantity: "3" }));
  const r = result(d); near(Number(r.summary.equity), 1215); near(Number(r.summary.unrealised), 100); near(Number(r.summary.financing), 3); near(Number(r.summary.fees), 2);
});
test("short exposure is negative and losses remain visible", () => {
  const d = ledger([100, 100, 120]); d.events = [event("opening", 0, { asset: "USDT", price: "1", quantity: "1000" }), event("margin-open", 1, { quantity: "5", positionId: "p", direction: "short" })];
  const r = result(d); near(Number(r.summary.equity), 900); near(r.publicData.netPct, -600 / 900 * 100); near(r.publicData.investedPct, 600 / 900 * 100);
});
test("partial then full margin close realises PnL without counting it twice", () => {
  const d = ledger([100, 110, 120]); d.events = [event("opening", 0, { asset: "USDT", quantity: "1000", price: "1" }), event("margin-open", 0, { quantity: "5", positionId: "p" }), event("margin-close", 1, { quantity: "2", price: "110", positionId: "p" }), event("margin-close", 2, { quantity: "3", price: "120", positionId: "p" })];
  const r = result(d); near(Number(r.summary.equity), 1080); near(Number(r.summary.realised), 80); assert.equal(r.summary.positions.length, 0); near(Number(r.summary.unrealised), 0);
});
test("spot trades use execution price and third-asset fees", () => {
  const d = ledger(); d.events.push(event("opening", 0, { asset: "USDT", quantity: "200", price: "1" }), event("buy", 1, { price: "90", feeAsset: "BTC", fee: "0.01" }));
  const r = result(d); near(Number(r.summary.equity), 309); near(Number(r.summary.fees), 1); near(Number(r.summary.btcHeld), 1.99);
});
test("missing/stale marks, negative inventory and duplicate source IDs reject the replay", () => {
  const d = ledger(); d.marks = d.marks.slice(0, 1); assert.throws(() => result(d), /stale/);
  const negative = ledger(); negative.events.push(event("sell", 1, { quantity: "2" })); assert.throws(() => result(negative), /Insufficient/);
  const duplicate = ledger(); duplicate.events[0].sourceId = "same"; duplicate.events.push(event("deposit", 1, { sourceId: "same" })); assert.throws(() => result(duplicate), /Duplicate source/);
});
test("zero/negative equity and full withdrawal require explicit tracking segments", () => {
  const d = ledger(); d.events.push(event("withdrawal", 1)); assert.throws(() => result(d), /Full withdrawal/);
  const loss = ledger([100, 100, 50]); loss.events.push(event("margin-open", 1, { quantity: "5", positionId: "p" })); assert.throws(() => result(loss), /negative equity/);
});
test("DCA counts actual fills; mismatched plans are rejected", () => {
  const d = makeMockLedger(), r = result(d); assert.equal(r.publicData.campaigns[0].recordedFills, 30);
  d.events.find(e => e.campaignId)!.campaignId = "missing"; assert.throws(() => result(d), /DCA fill/);
});
test("public projection contains no private economics, source IDs, notes or DCA amounts", () => {
  const d = makeMockLedger(); d.events.forEach(e => { e.privateNote = "PRIVATE_SENTINEL"; e.sourceId = `private-source-${e.id}`; });
  const r = result(d); const publicValue = JSON.stringify(r.publicData);
  for (const key of ["quantity", "price", "fee", "equity", "sourceId", "privateNote", "positionId", "amount", "btcEquivalent"]) assert.ok(!publicValue.includes(`"${key}":`), key);
  assert.ok(!publicValue.includes("PRIVATE_SENTINEL")); assert.ok(!publicValue.includes("private-source"));
  const sanitized = publicSchema.parse({ ...r.publicData, privateNote: "PRIVATE_SENTINEL", allocation: r.publicData.allocation.map(a => ({ ...a, quantity: "123.456" })) });
  assert.ok(!JSON.stringify(sanitized).includes("123.456"));
});
test("public reasons reject cash amounts and asset quantities", () => {
  for (const publicReason of ["Added $200", "Bought 0.2 BTC", "Reserve 500 USDT", "Risk 10 dollars"]) assert.equal(eventSchema.safeParse({ ...event("buy", 1), publicReason }).success, false);
});
test("return difference and BTC-relative growth are distinct", () => {
  const m = metrics([{ at: dates[0], portfolioIndex: 100, btcIndex: 100, weights: {} }, { at: dates[1], portfolioIndex: 120, btcIndex: 110, weights: {} }])!;
  near(m.difference, 10); near(m.relative, 100 / 11);
});
test("dates and YTD boundaries use UTC independently of daylight saving", () => {
  near(utcMidnight("2026-01-01"), Date.parse("2026-01-01T00:00:00Z")); near(utcMidnight("2026-07-01"), Date.parse("2026-07-01T00:00:00Z"));
  assert.equal(date("2025-12-31T20:00:00Z"), "31 Dec 2025");
  const data = result(makeMockLedger()).publicData;
  const points = periodPoints(data, "YTD", "", "");
  assert.equal(points[0].at, data.points.find(p => Date.parse(p.at) >= Date.parse("2026-01-01T00:00:00Z"))!.at);
});
test("relative public facts are invariant to absolute portfolio scale", () => {
  const d = makeMockLedger(), scaled = structuredClone(d);
  scaled.events.forEach(e => { e.quantity = String(Number(e.quantity) * 2); e.fee = String(Number(e.fee) * 2); });
  const a = result(d), b = result(scaled); near(a.publicData.investedPct, b.publicData.investedPct); near(metrics(a.publicData.points)!.relative, metrics(b.publicData.points)!.relative);
});
test("stale edits, invalid batches and unknown commands cannot mutate the input workspace", () => {
  const w = initialWorkspace(), original = JSON.stringify(w);
  assert.throws(() => applyCommand(w, { action: "replay", revision: 9, requestId: randomUUID() }, "test"), /changed/);
  assert.throws(() => applyCommand(w, { action: "import", revision: 0, requestId: randomUUID(), events: [event("sell", 1, { quantity: "999" })] }, "test"));
  assert.equal(JSON.stringify(w), original); assert.equal(commandSchema.safeParse({ action: "connect-kraken", revision: 0, requestId: randomUUID() }).success, false);
});
test("corrected records survive repeated source imports and retain audit evidence", () => {
  const w = initialWorkspace(), original = w.draft.events.find(e => e.id === "financing-300")!;
  const corrected = { ...original, quantity: "80", correctionReason: "Corrected fictional financing evidence" };
  const next = applyCommand(w, { action: "save-event", revision: 0, requestId: randomUUID(), event: corrected }, "test");
  const repeated = applyCommand(next, { action: "import", revision: 1, requestId: randomUUID(), events: [original] }, "test");
  assert.equal(repeated.draft.events.find(e => e.id === original.id)!.quantity, "80"); assert.equal(repeated.audit[0].before!.quantity, "90");
});
test("save stays private; replay is required for publish; release restore retains the draft", () => {
  const w = initialWorkspace(), e = { ...w.draft.events.find(e => e.id === "financing-300")!, quantity: "80", correctionReason: "Mock correction" };
  const changed = applyCommand(w, { action: "save-event", revision: 0, requestId: randomUUID(), event: e }, "test");
  assert.deepEqual(changed.published, w.published);
  assert.throws(() => applyCommand(changed, { action: "publish", revision: 1, requestId: randomUUID(), fingerprint: fingerprint(changed.draft) }, "test"), /Run the mock replay/);
  const replayed = applyCommand(changed, { action: "replay", revision: 1, requestId: randomUUID() }, "test");
  const published = applyCommand(replayed, { action: "publish", revision: 2, requestId: randomUUID(), fingerprint: fingerprint(replayed.draft) }, "test");
  assert.equal(published.published.release, 2);
  const restored = applyCommand(published, { action: "restore", revision: 3, requestId: randomUUID(), release: 1 }, "test");
  assert.deepEqual(restored.published, w.published); assert.deepEqual(restored.draft, published.draft);
});
test("retried operation IDs do not create additional revisions", () => {
  const w = initialWorkspace(), command = { action: "replay" as const, revision: 0, requestId: randomUUID() };
  const changed = applyCommand(w, command, "test"); assert.deepEqual(applyCommand(changed, command, "test"), changed);
});
test("paste format uses deterministic IDs and rejects malformed rows", () => {
  assert.deepEqual(parseImport(importExample), parseImport(importExample)); assert.throws(() => parseImport("bad\trow"), /13/);
});
test("activity shows combined BTC and cash allocation changes at execution time", () => {
  const d = ledger(); d.events[0].account = "cold";
  d.events.push(event("opening", 0, { asset: "USDT", quantity: "100", price: "1" }), event("buy", 1, { quantity: "0.2" }));
  const changes = result(d).publicData.activity[0].allocationChanges;
  near(changes.find(c => c.asset === "BTC")!.deltaPct, 10); near(changes.find(c => c.asset === "CASH")!.deltaPct, -10);
});
test("market gains before a purchase are excluded from its allocation delta", () => {
  const d = ledger([100, 200, 200]);
  d.events.push(event("opening", 0, { asset: "USDT", quantity: "100", price: "1" }), event("buy", 1, { quantity: "0.15", price: "200" }));
  const changes = result(d).publicData.activity[0].allocationChanges;
  near(changes.find(c => c.asset === "BTC")!.deltaPct, 10); near(changes.find(c => c.asset === "CASH")!.deltaPct, -10);
});
test("internal custody transfers do not create combined allocation changes", () => {
  const d = ledger(); d.events.push(event("transfer", 1, { quantity: "0.4" }));
  assert.deepEqual(result(d).publicData.activity[0].allocationChanges, []);
});
test("grouped allocation changes sum executions rather than including market drift", () => {
  const d = ledger([100, 100, 200]);
  d.events = [event("opening", 0, { asset: "USDT", quantity: "100", price: "1" }), event("buy", 1, { quantity: "0.1" }), event("buy", 2, { quantity: "0.1", price: "200" })];
  const r = result(d), changes = activityAllocationChanges(r.publicData.activity);
  near(changes.find(c => c.asset === "BTC")!.deltaPct, 10 + 20 / 110 * 100);
  near(changes.find(c => c.asset === "CASH")!.deltaPct, -(10 + 20 / 110 * 100));
  assert.ok(Math.abs(changes[0].deltaPct - r.publicData.allocation.find(a => a.asset === "BTC")!.weight) > 1);
});
test("the same portfolio can gain in BTC terms while losing in USD terms", () => {
  const m = metrics([{ at: dates[0], portfolioIndex: 100, btcIndex: 100, weights: {} }, { at: dates[1], portfolioIndex: 90, btcIndex: 80, weights: {} }])!;
  near(m.portfolio, -10); near(m.relative, 12.5);
});

function publicActivity(id: string, asset: PublicPortfolio["activity"][number]["asset"], at: string, kind: PublicPortfolio["activity"][number]["kind"] = "buy", campaignId = ""): PublicPortfolio["activity"][number] {
  return { id, asset, at, kind, campaignId, account: "margin", reason: "Fictional decision.", articleUrl: "", weightBefore: 0, weightAfter: 10, allocationChanges: [] };
}
test("activity filters offer only assets with non-fee decisions inside the selected period", () => {
  const activity = [publicActivity("a", "BTC", dates[0]), publicActivity("b", "HYPE", dates[1]), publicActivity("c", "SOL", dates[1], "fee"), publicActivity("d", "ETH", dates[2])];
  const view = portfolioActivityView(activity, dates[0], dates[1], "HYPE");
  assert.deepEqual(view.availableAssets, ["BTC", "HYPE"]);
  assert.equal(view.selectedAsset, "HYPE"); assert.equal(view.groups.length, 1); assert.equal(view.groups[0][0].id, "b");
});
test("an unavailable asset filter falls back to all available decisions and handles empty periods", () => {
  const activity = [publicActivity("a", "BTC", dates[0]), publicActivity("b", "HYPE", dates[1])];
  const view = portfolioActivityView(activity, dates[0], dates[0], "HYPE");
  assert.equal(view.selectedAsset, ""); assert.deepEqual(view.availableAssets, ["BTC"]); assert.equal(view.groups[0][0].id, "a");
  assert.deepEqual(portfolioActivityView(activity, undefined, undefined, "BTC"), { availableAssets: [], selectedAsset: "", groups: [] });
});
test("compact activity groups fills newest first without merging unrelated event IDs or mutating inputs", () => {
  const activity = [publicActivity("fill-1", "BTC", dates[0], "buy", "dca"), publicActivity("fill-2", "BTC", dates[1], "buy", "dca"), publicActivity("dca", "HYPE", dates[2], "sell")];
  const before = structuredClone(activity), view = portfolioActivityView(activity, dates[0], dates[2]);
  assert.equal(view.groups.length, 2); assert.equal(view.groups[0][0].asset, "HYPE"); assert.deepEqual(view.groups[1].map(e => e.id), ["fill-2", "fill-1"]);
  assert.deepEqual(activity, before);
});

test("UTC update labels are deterministic at midnight and across input offsets", () => {
  assert.equal(portfolioUpdateTime("2026-01-01T00:00:00.000Z"), "00:00:00 UTC");
  assert.equal(portfolioUpdateTime("2026-01-01T11:00:00+11:00"), "00:00:00 UTC");
  assert.equal(portfolioUpdateTime("2026-01-01T14:04:09Z"), "14:04:09 UTC");
});
