import assert from "node:assert/strict";
import test from "node:test";
import {
  PERFORMANCE_STALE_AFTER_MS,
  isPerformanceDatasetStale,
} from "./health";

const LAST_SUCCESS = new Date("2026-09-20T08:00:00.000Z");

test("keeps a recently synchronized journal available", () => {
  assert.equal(
    isPerformanceDatasetStale(
      LAST_SUCCESS,
      new Date(LAST_SUCCESS.getTime() + PERFORMANCE_STALE_AFTER_MS)
    ),
    false
  );
});

test("marks a journal stale after the freshness allowance", () => {
  assert.equal(
    isPerformanceDatasetStale(
      LAST_SUCCESS,
      new Date(LAST_SUCCESS.getTime() + PERFORMANCE_STALE_AFTER_MS + 1)
    ),
    true
  );
});
