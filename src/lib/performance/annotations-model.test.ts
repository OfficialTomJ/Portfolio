import assert from "node:assert/strict";
import test from "node:test";
import { asrStatus, buildAsrComparison, EMPTY_ANNOTATION, normalizeTagName, parseAnnotation, type TradeAnnotation, matchesTradeFilters, classifyLegacyTags } from "./annotations-model";
import type { PerformanceTrade } from "./types";
import { performanceReviewFingerprint } from "./review";

const trade: PerformanceTrade = { id: "trade-11111111111111111111", symbol: "BTCUSDT", direction: "Long", openedAt: "2026-09-01T00:00:00Z", closedAt: "2026-09-02T00:00:00Z", entryPrice: 100, exitPrice: 110, resultR: 1 };
const complete: TradeAnnotation = { ...EMPTY_ANNOTATION, expectedR: 2, valid: true };

test("paired ASR curves exclude incomplete reviews and preserve identical dates", () => {
  const invalid = { ...trade, id: "trade-22222222222222222222", closedAt: "2026-09-03T00:00:00Z", resultR: -1 };
  const incomplete = { ...trade, id: "trade-33333333333333333333", closedAt: "2026-09-04T00:00:00Z", resultR: 10 };
  const annotations = { [trade.id]: complete, [invalid.id]: { ...complete, valid: false, expectedR: 0 }, [incomplete.id]: { ...complete, valid: null } };
  const all = buildAsrComparison([trade, invalid, incomplete], annotations, new Date(trade.openedAt), "all");
  assert.equal(all.actualR, 0); assert.equal(all.expectedR, 2); assert.equal(all.gap, 2);
  assert.equal(all.reviewedCount, 2); assert.equal(all.eligibleCount, 3); assert.equal(all.incompleteCount, 1);
  assert.deepEqual(all.actual.map((point) => point.time), all.expected.map((point) => point.time));
  assert.equal(all.validCount, 1); assert.equal(all.invalidCount, 1);
  assert.equal(buildAsrComparison([trade, invalid], annotations, new Date(trade.openedAt), "valid").actualR, 1);
  assert.equal(buildAsrComparison([trade, invalid], annotations, new Date(trade.openedAt), "invalid").actualR, -1);
});

test("zero expected R and invalid false constitute a complete review", () => {
  assert.equal(asrStatus({ ...EMPTY_ANNOTATION, expectedR: 0, valid: false }), "Reviewed");
  assert.equal(asrStatus({ ...EMPTY_ANNOTATION, expectedR: -1 }), "Incomplete");
  assert.equal(asrStatus(), "Not reviewed");
});

test("metadata validation accepts drafts, deduplicates tags, and rejects unauthorized fields", () => {
  assert.deepEqual(parseAnnotation({ ...EMPTY_ANNOTATION, privateNotes: "  note  " }, false).privateNotes, "note");
  assert.throws(() => parseAnnotation({ ...EMPTY_ANNOTATION, resultR: 50 }, true), /Unknown/);
  assert.throws(() => parseAnnotation({ ...complete, expectedR: Number.NaN }, true), /Expected R/);
  assert.throws(() => parseAnnotation({ ...complete, valid: "true" }, true), /valid/);
  assert.throws(() => parseAnnotation({ ...complete }, false), /after/);
  assert.throws(() => parseAnnotation({ ...EMPTY_ANNOTATION, asrComments: "review" }, false), /after/);
  const id = "tag-11111111111111111111";
  assert.deepEqual(parseAnnotation({ ...EMPTY_ANNOTATION, strategyIds: [id, id] }, true).strategyIds, [id]);
});

test("tag normalization rejects control characters and markup", () => {
  assert.equal(normalizeTagName("  Day   Trade  "), "Day Trade");
  assert.throws(() => normalizeTagName("<script>")); assert.throws(() => normalizeTagName(""));
});

test("manual metadata does not change publication fingerprints", () => {
  const fingerprint = performanceReviewFingerprint(trade, [], "risk-v1", 1000);
  assert.equal(performanceReviewFingerprint({ ...trade, description: "Public notes", tradeType: "SWING" }, [], "risk-v1", 1000), fingerprint);
});

test("filters use OR within groups and AND across groups without duplicating trades", () => {
  assert.equal(matchesTradeFilters("DAY", ["acb"], ["DAY"], ["acb", "ibo"]), true);
  assert.equal(matchesTradeFilters("DAY", ["ibo"], ["DAY"], ["acb", "ibo"]), true);
  assert.equal(matchesTradeFilters("SWING", ["acb"], ["DAY"], ["acb", "ibo"]), false);
  assert.equal(matchesTradeFilters("DAY", ["other"], ["DAY"], ["acb", "ibo"]), false);
  assert.equal(matchesTradeFilters(null, [], [], []), true);
  assert.equal(matchesTradeFilters(null, [], ["DAY", "SWING"], []), false);
  assert.equal(matchesTradeFilters(null, [], ["UNCLASSIFIED"], []), true);
  const rows = [{ type: "DAY" as const, strategies: ["acb", "ibo"] }];
  assert.equal(rows.filter(row => matchesTradeFilters(row.type, row.strategies, ["DAY"], ["acb", "ibo"])).length, 1);
});

test("trade type is fixed and legacy or public strategy fields are rejected", () => {
  assert.throws(() => parseAnnotation({ ...EMPTY_ANNOTATION, tradeType: "IBO" }, true), /Day/);
  assert.throws(() => parseAnnotation({ ...EMPTY_ANNOTATION, tagIds: [] }, true), /Unknown/);
  assert.equal(parseAnnotation({ ...EMPTY_ANNOTATION, tradeType: "DAY" }, false).tradeType, "DAY");
});

test("legacy migration classifies known types only, keeps unknown tags private, and flags conflicts", () => {
  const tags = [{ id: "day", name: " Day " }, { id: "swing", name: "Swing Trade" }, { id: "acb", name: "ACB" }];
  assert.deepEqual(classifyLegacyTags(["day", "acb", "acb", "unknown"], tags), { tradeType: "DAY", strategyIds: ["acb", "unknown"], conflict: false });
  assert.deepEqual(classifyLegacyTags(["day", "swing", "acb"], tags), { tradeType: null, strategyIds: ["acb"], conflict: true });
});
