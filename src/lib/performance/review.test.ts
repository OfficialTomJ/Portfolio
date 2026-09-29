import assert from "node:assert/strict";
import test from "node:test";
import { mayPublishReviewedTrade, performanceReviewFingerprint } from "./review";
import type { BybitClosedPnl } from "./bybit";
import type { PerformanceTrade } from "./types";

const trade: PerformanceTrade = {
  id: "trade-example",
  symbol: "BTCUSDT",
  direction: "Long",
  openedAt: "2026-09-01T00:00:00.000Z",
  closedAt: "2026-09-02T00:00:00.000Z",
  entryPrice: 100,
  exitPrice: 99,
  resultR: -0.5,
};
const record: BybitClosedPnl = {
  orderId: "close-example",
  symbol: "BTCUSDT",
  side: "Sell",
  qty: "1",
  closedSize: "1",
  avgEntryPrice: "100",
  avgExitPrice: "99",
  closedPnl: "-500",
  execType: "Trade",
  createdTime: "1788307200000",
  updatedTime: "1788307200000",
};

test("a closed trade stays private until the exact candidate is approved", () => {
  const fingerprint = performanceReviewFingerprint(trade, [record], "risk-v1", 1000);
  assert.equal(mayPublishReviewedTrade({
    alreadyPublished: false, active: false, excluded: false, held: false,
    candidateFingerprint: fingerprint,
  }), false);
  assert.equal(mayPublishReviewedTrade({
    alreadyPublished: false, active: false, excluded: false, held: false,
    candidateFingerprint: fingerprint, approvedFingerprint: fingerprint,
  }), true);
});

test("changed source data or risk invalidates approval", () => {
  const original = performanceReviewFingerprint(trade, [record], "risk-v1", 1000);
  const revised = performanceReviewFingerprint(trade, [{ ...record, closedPnl: "-700" }], "risk-v1", 1000);
  assert.notEqual(original, revised);
  assert.notEqual(original, performanceReviewFingerprint(trade, [record], "risk-v2", 1000));
  assert.equal(mayPublishReviewedTrade({
    alreadyPublished: false, active: false, excluded: false, held: false,
    candidateFingerprint: revised, approvedFingerprint: original,
  }), false);
});

test("approval never overrides active, excluded or held status", () => {
  for (const flag of ["active", "excluded", "held"] as const) {
    assert.equal(mayPublishReviewedTrade({
      alreadyPublished: false, active: false, excluded: false, held: false,
      [flag]: true, candidateFingerprint: "same", approvedFingerprint: "same",
    }), false);
  }
});
