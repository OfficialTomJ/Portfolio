import assert from "node:assert/strict";
import test from "node:test";
import { groupPublicRecord, ideaExcerpt, type PublicIdeaView } from "./public-record";
import type { PerformanceTrade } from "./types";

const trade = (id: string, resultR = 1): PerformanceTrade => ({
  id, symbol: "BTCUSDT", direction: "Long", openedAt: "2026-10-10T00:00:00Z",
  closedAt: "2026-10-11T00:00:00Z", entryPrice: 60000, exitPrice: 61000, resultR,
});
const idea = (id: string, trades: PerformanceTrade[], ideaAt = "2026-10-01T00:00:00Z"): PublicIdeaView => ({
  id, trades, title: id, thesis: "Public thesis", target: "", invalidation: "", articleUrl: "",
  status: "active", ideaAt, firstPublishedAt: ideaAt, updatedAt: ideaAt, tradeIds: trades.map(t => t.id),
});

test("idea groups use only the selected public trades and preserve all selected results exactly once", () => {
  const a = trade("a", 2), b = trade("b", -1), c = trade("c", .5), historical = trade("old", 7);
  const { groups, ungrouped } = groupPublicRecord([idea("one", [a, b, historical]), idea("old-only", [historical])], [c, b, a]);
  assert.deepEqual(groups.map(g => [g.idea.id, g.trades.map(t => t.id)]), [["one", ["b", "a"]]]);
  assert.deepEqual(ungrouped.map(t => t.id), ["c"]);
  const groupedTrades = [...groups.flatMap(g => g.trades), ...ungrouped];
  assert.equal(new Set(groupedTrades.map(t => t.id)).size, 3);
  assert.equal(groupedTrades.reduce((s, t) => s + t.resultR, 0), 1.5);
});

test("ideas without closed trades remain discoverable, but a selected calendar day only shows matching executions", () => {
  const a = trade("a");
  const ideas = [idea("older", [a]), idea("new-analysis", [], "2026-10-20T00:00:00Z")];
  assert.deepEqual(groupPublicRecord(ideas, [a]).groups.map(g => g.idea.id), ["new-analysis", "older"]);
  assert.deepEqual(groupPublicRecord(ideas, [a], true).groups.map(g => g.idea.id), ["older"]);
  assert.deepEqual(groupPublicRecord(ideas, [], true), { groups: [], ungrouped: [] });
});

test("legacy overlapping idea links cannot duplicate a trade in the grouped record", () => {
  const a = trade("a");
  const result = groupPublicRecord([idea("one", [a]), idea("two", [a])], [a]);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].idea.id, "one");
  assert.equal(result.ungrouped.length, 0);
});

test("idea excerpts bound long public text and normalize whitespace", () => {
  assert.equal(ideaExcerpt("  Short\n public  thesis. "), "Short public thesis.");
  assert.equal(ideaExcerpt("A long thesis", 6), "A long…");
  assert.equal(ideaExcerpt("x".repeat(5000)).length, 171);
});
