import assert from "node:assert/strict";
import test from "node:test";
import { assembleAdminReview, type ReviewCycleCandidate } from "./admin-selection";
import type { PerformanceDataset, PerformanceTrade } from "./types";

const lastSync = new Date("2026-09-30T10:00:00.000Z");
const published: PerformanceTrade = {
  id: "trade-11111111111111111111",
  symbol: "ETHUSDT",
  direction: "Long",
  openedAt: "2026-09-28T09:00:00.000Z",
  closedAt: "2026-09-29T09:00:00.000Z",
  resultR: 0.5,
  entryPrice: 100,
  exitPrice: 101,
};
const pending: PerformanceTrade = {
  ...published,
  id: "trade-22222222222222222222",
  symbol: "BTCUSDT",
  direction: "Short",
  resultR: -0.25,
};
const dataset: PerformanceDataset = {
  id: "live",
  label: "Connected account",
  description: "Published closed trades",
  inceptionAt: "2026-09-01T00:00:00.000Z",
  asOf: lastSync.toISOString(),
  trades: [published],
};
const baseCycle: ReviewCycleCandidate = {
  status: "pending_review",
  symbol: pending.symbol,
  direction: pending.direction,
  openedAt: new Date(pending.openedAt),
  lastSeenAt: lastSync,
  entryPrice: pending.entryPrice,
  reviewCandidate: pending,
  reviewFingerprint: "a".repeat(64),
};

test("admin review combines published and valid pending trades without duplicates or held records", () => {
  const result = assembleAdminReview(dataset, [
    baseCycle,
    { ...baseCycle, reviewCandidate: published },
    { ...baseCycle, reviewCandidate: { ...pending, id: "trade-33333333333333333333" }, publicationHold: true },
    { ...baseCycle, reviewCandidate: { ...pending, id: "trade-44444444444444444444" }, excludedFromJournal: true },
    { ...baseCycle, reviewCandidate: { ...pending, id: "invalid" } },
    { ...baseCycle, reviewFingerprint: undefined },
  ], [], lastSync);
  assert.deepEqual(result.pendingTradeIds, [pending.id]);
  assert.deepEqual(result.dataset.trades.map((trade) => trade.id), [published.id, pending.id]);
  assert.equal(result.dataset.trades.reduce((sum, trade) => sum + trade.resultR, 0), 0.25);
});

test("active cards only represent positions observed in the latest successful sync", () => {
  const result = assembleAdminReview(dataset, [], [
    { ...baseCycle, status: "open", reviewCandidate: undefined },
    { ...baseCycle, status: "open", lastSeenAt: new Date("2026-09-29T10:00:00.000Z") },
    { ...baseCycle, status: "excluded", symbol: "SOLUSDT" },
  ], lastSync);
  assert.deepEqual(result.activePositions.map((position) => position.symbol), ["BTCUSDT", "SOLUSDT"]);
  assert.equal(result.dataset.trades.length, 1);
});
