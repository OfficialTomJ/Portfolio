import assert from "node:assert/strict";
import test from "node:test";
import { publicRiskEvents, riskEventTimeline, RISK_REDUCTION_NOTICE } from "./risk-events";
import { assertRiskChange } from "./risk-change";
import { riskPreviewEnabled } from "./risk-preview";
import { buildPerformanceView } from "./metrics";
import { lockPerformanceRisk, selectRiskVersion } from "./risk";
import { normalizeClosedCycle } from "./normalize";
import { journalSocialImageKey, legacyJournalImageVersion, tradeSocialImageKey } from "./social-image-keys";
import type { PerformanceDataset, PublicRiskEvent } from "./types";

const at = "2026-10-18T00:00:00.000Z";
const notice = { id: "risk-event-0123456789abcdef0123", ...RISK_REDUCTION_NOTICE };
const event: PublicRiskEvent = { ...notice, effectiveAt: at };
const dataset: PerformanceDataset = { id: "test", label: "Test", description: "Test", inceptionAt: "2026-10-01T00:00:00Z", asOf: "2026-10-19T00:00:00Z", trades: [
  { id: "old", symbol: "BTCUSDT", direction: "Long", openedAt: "2026-10-16T00:00:00Z", closedAt: "2026-10-17T00:00:00Z", resultR: -2, entryPrice: 100, exitPrice: 98 },
  { id: "new", symbol: "ETHUSDT", direction: "Long", openedAt: at, closedAt: "2026-10-18T12:00:00Z", resultR: 1, entryPrice: 100, exitPrice: 101 },
] };

test("public risk DTOs exclude future, malformed and private fields", () => {
  const privateDoc = { effectiveFrom: new Date(at), publicNotice: notice, riskAmount: 50, sourceAccountId: "secret-account", reason: "private-reason" };
  const events = publicRiskEvents([privateDoc, { effectiveFrom: new Date("2027-01-01"), publicNotice: notice }, { effectiveFrom: "bad", publicNotice: notice }, { effectiveFrom: new Date(at) }], new Date(dataset.asOf));
  assert.deepEqual(events, [event]);
  assert.ok(!JSON.stringify(events).includes("secret-account"));
  assert.deepEqual(Object.keys(events[0]).sort(), ["description", "effectiveAt", "id", "title"]);
});

test("risk boundary uses entry time, including trades closing after the cutoff", () => {
  const versions = [{ id: "v1", sourceAccountId: "a", environment: "demo", version: 1, riskAmount: 1000, currency: "USDT" as const, effectiveFrom: new Date("2026-01-01") },
    { id: "v2", sourceAccountId: "a", environment: "demo", version: 2, riskAmount: 50, currency: "USDT" as const, effectiveFrom: new Date(at) }];
  assert.equal(selectRiskVersion(versions, new Date(Date.parse(at) - 1))?.riskAmount, 1000);
  assert.equal(selectRiskVersion(versions, new Date(at))?.riskAmount, 50);
  assert.equal(selectRiskVersion(versions, new Date(Date.parse(at) + 1))?.riskAmount, 50);
  const locked = lockPerformanceRisk({ riskVersionId: "v1", riskAmount: 1000, riskCurrency: "USDT" }, versions, new Date("2026-10-17"));
  assert.equal(locked?.riskAmount, 1000);
  const base = { id: "trade", symbol: "BTCUSDT", direction: "Long" as const, openedAt: new Date(at), fallbackEntryPrice: 100 };
  const slices = [{ avgEntryPrice: 100, avgExitPrice: 99, closedSize: 1, qty: 1, closedPnl: -50, updatedTime: Date.parse("2026-10-19") }];
  const old = normalizeClosedCycle({ ...base, riskAmount: 1000 }, slices);
  const next = normalizeClosedCycle({ ...base, riskAmount: 50 }, slices);
  assert.equal(old.ok && old.trade.resultR, -0.05);
  assert.equal(next.ok && next.trade.resultR, -1);
});

test("adding an event leaves metrics and the actual equity series untouched", () => {
  const original = buildPerformanceView(dataset, "YTD", 2026);
  const withEvent = buildPerformanceView({ ...dataset, riskEvents: [event] }, "YTD", 2026);
  assert.deepEqual(withEvent.stats, original.stats);
  assert.deepEqual(withEvent.equity, original.equity);
  assert.deepEqual(withEvent.riskEvents, [event]);
});

test("filters preserve post-change context and use Sydney custom date boundaries", () => {
  const d = { ...dataset, riskEvents: [event] };
  const later = buildPerformanceView(d, "CUSTOM", 2026, { start: "2026-10-19", end: "2026-10-19" });
  assert.deepEqual(later.riskEvents, []);
  assert.deepEqual(later.riskContext, event);
  const before = buildPerformanceView(d, "CUSTOM", 2026, { start: "2026-10-01", end: "2026-10-17" });
  assert.equal(before.riskContext, undefined);
  const sydneyEvening = { ...event, effectiveAt: "2026-10-18T13:30:00Z" }; // 19 October in Sydney
  const selected = buildPerformanceView({ ...d, riskEvents: [sydneyEvening] }, "CUSTOM", 2026, { start: "2026-10-19", end: "2026-10-19" });
  assert.deepEqual(selected.riskEvents, [sydneyEvening]);
  const future = buildPerformanceView({ ...dataset, riskEvents: [{ ...event, effectiveAt: "2027-01-01" }] }, "YTD", 2026);
  assert.equal(future.riskContext, undefined);
});

test("presentation anchors cover gaps and the paused tail without manufacturing returns", () => {
  const points = [{ time: 10, value: 0 }, { time: 20, value: -2 }, { time: 40, value: -1 }];
  const e = (time: number) => ({ ...event, effectiveAt: new Date(time * 1000).toISOString() });
  assert.deepEqual(riskEventTimeline(points, [e(30), e(40), e(50)]), [points[0], points[1], { time: 30, value: -2 }, points[2], { time: 50, value: -1 }]);
  assert.equal(points.length, 3);
  assert.deepEqual(riskEventTimeline([], [e(30)]), []);
});

test("journal image and legacy keys change for notices without new trades; trade keys stay fixed", () => {
  const original = buildPerformanceView(dataset, "YTD", 2026);
  const changed = buildPerformanceView({ ...dataset, riskEvents: [event] }, "YTD", 2026);
  assert.notEqual(journalSocialImageKey(dataset, original), journalSocialImageKey(dataset, changed));
  assert.notEqual(legacyJournalImageVersion(original), legacyJournalImageVersion(changed));
  assert.equal(tradeSocialImageKey(dataset.trades[0]), tradeSocialImageKey({ ...dataset.trades[0] }));
  const laterSync = buildPerformanceView({ ...dataset, asOf: "2026-10-19T01:00:00Z", riskEvents: [event] }, "YTD", 2026);
  assert.equal(journalSocialImageKey(dataset, changed), journalSocialImageKey(dataset, laterSync));
});

test("cutover rejects wrong accounts, changed risk, open positions, backdating and fake reductions", () => {
  const input = { riskAmount: 50, effectiveFrom: new Date(at), reason: "trial", expectedAccountId: "a", expectedCurrentAmount: 1000, publicNotice: true };
  const facts = { accountId: "a", currentAmount: 1000, openPositionCount: 0, now: new Date("2026-10-17"), latestOpenedAt: new Date("2026-10-16") };
  assert.doesNotThrow(() => assertRiskChange(input, facts));
  assert.throws(() => assertRiskChange(input, { ...facts, accountId: "b" }), /account/);
  assert.throws(() => assertRiskChange(input, { ...facts, currentAmount: 200 }), /changed/);
  assert.throws(() => assertRiskChange(input, { ...facts, openPositionCount: 1 }), /flat/);
  assert.throws(() => assertRiskChange(input, { ...facts, now: new Date("2026-10-19") }), /Backdated/);
  assert.throws(() => assertRiskChange(input, { ...facts, latestOpenedAt: new Date(at) }), /existing/);
  assert.throws(() => assertRiskChange({ ...input, riskAmount: 2000 }, facts), /reduction/);
});


test("synthetic preview requires explicit preview, development database and opt-in", () => {
  const names = ["VERCEL_ENV", "MONGODB_DB", "PERFORMANCE_RISK_PREVIEW"] as const;
  const before = names.map(name => process.env[name]);
  try {
    process.env.PERFORMANCE_RISK_PREVIEW = "1";
    process.env.MONGODB_DB = "blueprint_dev";
    process.env.VERCEL_ENV = "preview";
    assert.equal(riskPreviewEnabled(), true);
    process.env.VERCEL_ENV = "production";
    assert.equal(riskPreviewEnabled(), false);
    process.env.VERCEL_ENV = "preview";
    process.env.MONGODB_DB = "blueprint_prod";
    assert.equal(riskPreviewEnabled(), false);
    process.env.MONGODB_DB = "blueprint_dev";
    delete process.env.PERFORMANCE_RISK_PREVIEW;
    assert.equal(riskPreviewEnabled(), false);
  } finally {
    names.forEach((name, i) => { if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i]; });
  }
});
