import assert from "node:assert/strict";
import test from "node:test";

import { EMPTY_ANNOTATION } from "./annotations-model";
import { filterReviewTrades, nextUnreviewedTradeId } from "./review-workspace";
import type { PerformanceTrade } from "./types";

const base: PerformanceTrade = { id: "one", symbol: "ETHUSDT", direction: "Long", openedAt: "2026-09-01T00:00:00Z", closedAt: "2026-09-02T00:00:00Z", resultR: -0.5, entryPrice: 100, exitPrice: 99 };
const trades = [base, { ...base, id: "two", closedAt: "2026-09-03T00:00:00Z" }, { ...base, id: "three", symbol: "BTCUSDT", closedAt: "2026-09-04T00:00:00Z" }];
const annotations = { one: { ...EMPTY_ANNOTATION }, two: { ...EMPTY_ANNOTATION, expectedR: 0, valid: false }, three: { ...EMPTY_ANNOTATION, expectedR: 2 } };
const pending = new Set(["two", "three"]);

test("reconciliation never contributes records to closed result filters", () => {
  assert.deepEqual(filterReviewTrades(trades, annotations, pending, "reconciliation", "all"), []);
});

test("ASR queue includes published unreviewed and pending incomplete trades", () => {
  assert.deepEqual(filterReviewTrades(trades, annotations, pending, "needs_asr", "all").map(t => t.id), ["one", "three"]);
  assert.deepEqual(filterReviewTrades(trades, annotations, pending, "needs_asr", "published").map(t => t.id), ["one"]);
  assert.deepEqual(filterReviewTrades(trades, annotations, pending, "needs_asr", "pending").map(t => t.id), ["three"]);
});
test("zero expected R and invalid trade count as reviewed without publication", () => {
  assert.deepEqual(filterReviewTrades(trades, annotations, pending, "reviewed", "all").map(t => t.id), ["two"]);
  assert.ok(pending.has("two"));
});
test("search and publication filters intersect without changing input records", () => {
  const before = JSON.stringify({ trades, annotations });
  assert.deepEqual(filterReviewTrades(trades, annotations, pending, "all", "pending", " btc ").map(t => t.id), ["three"]);
  assert.deepEqual(filterReviewTrades(trades, annotations, pending, "active", "all"), []);
  assert.equal(JSON.stringify({ trades, annotations }), before);
});
test("next unreviewed excludes current and complete trades and has a stable ending", () => {
  assert.equal(nextUnreviewedTradeId("one", trades, annotations), "three");
  assert.equal(nextUnreviewedTradeId("three", trades, annotations), "one");
  assert.equal(nextUnreviewedTradeId("one", [trades[0], trades[1]], annotations), null);
  assert.equal(nextUnreviewedTradeId("none", [], {}), null);
});
