import assert from "node:assert/strict";
import test from "node:test";
import { calendarMonthRange, getCalendarMonthKeys } from "./metrics";
import type { PerformanceDataset } from "./types";

const dataset: PerformanceDataset = {
  id: "live",
  label: "Connected account",
  description: "Published closed trades",
  inceptionAt: "2025-12-18T23:30:00.000Z",
  asOf: "2026-02-15T13:00:00.000Z",
  trades: [],
};

test("builds newest-first Sydney calendar months across years", () => {
  assert.deepEqual(getCalendarMonthKeys(dataset), [
    "2026-02",
    "2026-01",
    "2025-12",
  ]);
});

test("caps the current calendar month at the latest sync date", () => {
  assert.deepEqual(calendarMonthRange("2026-02", dataset.asOf), {
    start: "2026-02-01",
    end: "2026-02-16",
  });
});

test("returns the full bounds for a completed leap-year month", () => {
  assert.deepEqual(calendarMonthRange("2024-02", dataset.asOf), {
    start: "2024-02-01",
    end: "2024-02-29",
  });
});

test("rejects malformed calendar month keys", () => {
  assert.throws(() => calendarMonthRange("2026-13", dataset.asOf), /Invalid calendar month/);
});
