import assert from "node:assert/strict";
import test from "node:test";
import { buildPerformanceView } from "./metrics";
import {
  journalLegacyImageKey,
  journalSocialImageKey,
  legacyJournalImageVersion,
  parseSocialImagePathKey,
  tradeLegacyImageKey,
  tradeSocialImageKey,
} from "./social-image-keys";
import type { PerformanceDataset, PerformanceTrade } from "./types";

const trade: PerformanceTrade = {
  id: "trade-test",
  symbol: "SOLUSDT",
  direction: "Long",
  openedAt: "2026-09-21T00:24:07.284Z",
  closedAt: "2026-09-21T20:57:25.329Z",
  resultR: 1.2,
  entryPrice: 112.75,
  exitPrice: 119.17,
};

function dataset(asOf: string, trades = [trade]): PerformanceDataset {
  return {
    id: "live",
    label: "Connected account",
    description: "Published closed trades",
    inceptionAt: "2026-09-01T00:00:00.000Z",
    asOf,
    trades,
  };
}

test("trade image keys are deterministic and change with public trade facts", () => {
  assert.equal(tradeSocialImageKey(trade), tradeSocialImageKey({ ...trade }));
  assert.notEqual(tradeSocialImageKey(trade), tradeSocialImageKey({ ...trade, resultR: 1.21 }));
});

test("journal keys ignore sync-only timestamps but change with published results", () => {
  const first = dataset("2026-09-22T00:00:00.000Z");
  const laterSync = dataset("2026-09-22T12:00:00.000Z");
  const changed = dataset("2026-09-22T12:00:00.000Z", [{ ...trade, resultR: 1.21 }]);
  const firstView = buildPerformanceView(first, "YTD", 2026);
  const laterView = buildPerformanceView(laterSync, "YTD", 2026);
  const changedView = buildPerformanceView(changed, "YTD", 2026);

  assert.equal(journalSocialImageKey(first, firstView), journalSocialImageKey(laterSync, laterView));
  assert.notEqual(journalSocialImageKey(first, firstView), journalSocialImageKey(changed, changedView));
});

test("public image path keys accept only bounded safe values", () => {
  assert.equal(parseSocialImagePathKey("trade-test-deadbeef-r1.png"), "trade-test-deadbeef-r1");
  assert.equal(parseSocialImagePathKey("../secret.png"), null);
  assert.equal(parseSocialImagePathKey("trade/test.png"), null);
});

test("legacy aliases preserve the existing journal and trade image URLs", () => {
  const view = buildPerformanceView(dataset("2026-09-22T00:00:00.000Z"), "YTD", 2026);

  assert.equal(legacyJournalImageVersion(view), "1-trade-test-1.2000");
  assert.equal(journalLegacyImageKey(legacyJournalImageVersion(view)), "journal:1-trade-test-1.2000");
  assert.equal(tradeLegacyImageKey(trade.id), "trade:trade-test");
});
