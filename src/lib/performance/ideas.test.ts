import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_IDEA_FIELDS, ideaMutationSchema, tradeIdeaEditSchema, summariseIdea } from "./ideas-model";
import { selectIdeaTrades, selectJournalIdeaTrades, type IdeaCycleSource } from "./ideas-selection";
import { BREAKOUT_HEADERS, parseBreakoutCsv, type BreakoutAccount, type BreakoutRecord } from "./breakout";
import { publicTradeIdForCycle } from "./publication";
import type { PerformanceTrade } from "./types";

const cycle: IdeaCycleSource = { _id: "cycle", symbol: "BTCUSDT", direction: "Long", openedAt: new Date("2026-10-01T00:00:00Z"), closedAt: new Date("2026-10-02T00:00:00Z"), status: "published", entryPrice: 100, quantity: 10, riskAmount: 1000 };
const trade: PerformanceTrade = { id: publicTradeIdForCycle(cycle._id), symbol: cycle.symbol, direction: cycle.direction, openedAt: cycle.openedAt.toISOString(), closedAt: cycle.closedAt!.toISOString(), entryPrice: 100, exitPrice: 110, resultR: 2 };

test("idea history uses selected clean Breakout results, keeps Bybit archives and omits held positions", () => {
  const row = parseBreakoutCsv(new TextEncoder().encode([BREAKOUT_HEADERS.join(","), "BTC/USD,long,1,100,110,2026-10-01T00:00:00Z,2026-10-02T00:00:00Z,10,1,9"].join("\n"))).rows[0];
  const imported = { ...row, _id: row.trade.id, status: "pending_review" } as BreakoutRecord;
  const legacy = selectIdeaTrades([cycle], [trade], []);
  const selected = selectJournalIdeaTrades(legacy, [imported, { ...imported, status: "reconciliation", _id: "held" }], { historyFrom: "2026-09-30T00:00:00.000Z" } as BreakoutAccount);
  assert.equal(selected.length, 2);
  assert.equal(selected.find(t => t.id === trade.id)?.status, "archived_bybit");
  assert.equal(selected.find(t => t.id === trade.id)?.resultR, null);
  assert.equal(selected.find(t => t.id === imported._id)?.resultR, 0.009);
  assert.equal(selectJournalIdeaTrades([], [imported], null)[0].id, imported._id, "Breakout-only accounts require no Bybit sync");
});

test("history uses scoped cycles, accepted journal results and valid pending candidates", () => {
  const pending = { ...cycle, _id: "pending", status: "pending_review", reviewFingerprint: "a".repeat(64), reviewCandidate: { ...trade, id: publicTradeIdForCycle("pending"), resultR: -0.5 } };
  const rows = selectIdeaTrades([cycle, pending, { ...cycle, _id: "open", status: "open" }], [trade, { ...trade, id: publicTradeIdForCycle("other-account") }], []);
  assert.equal(rows.length, 2);
  assert.equal(rows.reduce((s, x) => s + x.resultR!, 0), 1.5);
  assert.ok(rows.every(t => !t.exception));
  assert.equal(rows.find(t => t.status === "pending_review")!.resultR, -0.5);
});

test("held, excluded and malformed candidates remain groupable without contaminating totals", () => {
  const rows = selectIdeaTrades([
    { ...cycle, publicationHold: true },
    { ...cycle, _id: "excluded", quantity: 11, status: "excluded", excludedFromJournal: true },
    { ...cycle, _id: "bad", quantity: 12, status: "pending_review", reviewCandidate: { ...trade, id: publicTradeIdForCycle("bad") } },
  ], [trade], []);
  assert.ok(rows.every(t => t.resultR === null && t.exception && !t.duplicateOf));
  const stats = summariseIdea(rows);
  assert.equal(stats.netR, null);
  assert.equal(stats.unknownCount, 3);
});

test("legacy aliases are suppressed only with matching entry, quantity and close evidence", () => {
  const alias = { ...cycle, _id: "alias", status: "excluded", excludedFromJournal: true, openedAt: new Date(cycle.openedAt.getTime() - 1) };
  const rows = selectIdeaTrades([cycle, alias, { ...alias, _id: "different-size", quantity: 11 }], [trade], []);
  assert.equal(rows.find(t => t.id === publicTradeIdForCycle("alias"))!.duplicateOf, trade.id);
  assert.equal(rows.find(t => t.id === publicTradeIdForCycle("different-size"))!.duplicateOf, null);
  assert.equal(summariseIdea(rows).count, 2);
  assert.equal(summariseIdea(rows).netR, 2);
});

test("two excluded aliases retain the canonical cycle with actual PnL evidence", () => {
  const other = { ...cycle, _id: "canonical", status: "excluded", openedAt: new Date(cycle.openedAt.getTime() + 1) };
  const rows = selectIdeaTrades([{ ...cycle, status: "excluded" }, other], [], [{ cycleId: other._id, closedPnl: "-20", execType: "Trade" }]);
  assert.equal(rows.find(t => t.id === publicTradeIdForCycle(cycle._id))!.duplicateOf, publicTradeIdForCycle(other._id));
  assert.equal(rows.find(t => t.id === publicTradeIdForCycle(other._id))!.duplicateOf, null);
  assert.equal(summariseIdea(rows).netR, null);
});

test("attribution discrepancies flag the result rather than substituting later closing slices", () => {
  const rows = selectIdeaTrades([cycle], [trade], [{ cycleId: cycle._id, closedPnl: "1800", execType: "Trade" }]);
  assert.equal(rows[0].resultR, 2);
  assert.match(rows[0].warning, /attribution differs/);
});

test("idea summary deduplicates trade IDs and keeps chronological cumulative net and loss totals", () => {
  const [base] = selectIdeaTrades([cycle], [trade], []);
  const first = { ...base, id: publicTradeIdForCycle("first"), resultR: -1, openedAt: "2026-09-28T00:00:00Z", closedAt: "2026-09-29T00:00:00Z" };
  const unknown = { ...base, id: publicTradeIdForCycle("unknown"), resultR: null, warning: "Needs reconciliation", closedAt: "2026-10-03T00:00:00Z" };
  const stats = summariseIdea([base, unknown, first, first]);
  assert.equal(stats.count, 3); assert.equal(stats.netR, 1);
  assert.equal(stats.grossWins, 2); assert.equal(stats.grossLosses, -1);
  assert.equal(stats.winners, 1); assert.equal(stats.losers, 1);
  assert.deepEqual(stats.timeline.map(t => t.cumulativeR), [-1, 1, null]);
  assert.equal(stats.firstEntry, first.openedAt); assert.equal(stats.lastExit, unknown.closedAt);
});

test("mutations reject invalid IDs, duplicate selections, unrecognised fields and blank names", () => {
  assert.equal(ideaMutationSchema.safeParse({ action: "create", revision: 0, fields: { ...EMPTY_IDEA_FIELDS, name: "   " }, tradeIds: [] }).success, false);
  const valid = { action: "create", revision: 0, fields: { ...EMPTY_IDEA_FIELDS, name: " ZEC swing " }, tradeIds: [trade.id] };
  assert.equal(ideaMutationSchema.parse(valid).action, "create");
  assert.equal(ideaMutationSchema.safeParse({ ...valid, tradeIds: [trade.id, trade.id] }).success, false);
  assert.equal(ideaMutationSchema.safeParse({ ...valid, tradeIds: ["bad"] }).success, false);
  assert.equal(ideaMutationSchema.safeParse({ ...valid, resultR: 7 }).success, false);
  assert.equal(ideaMutationSchema.safeParse({ ...valid, revision: -1 }).success, false);
});

test("trade panel idea edits cannot smuggle other trades or change results", () => {
  assert.equal(tradeIdeaEditSchema.safeParse({ action: "assign", revision: 37, ideaId: null }).success, true);
  assert.equal(tradeIdeaEditSchema.safeParse({ action: "assign", revision: 37, ideaId: null, tradeIds: [trade.id] }).success, false);
  assert.equal(tradeIdeaEditSchema.safeParse({ action: "create", revision: 37, fields: { ...EMPTY_IDEA_FIELDS, name: "BTC range" } }).success, true);
  assert.equal(tradeIdeaEditSchema.safeParse({ action: "create", revision: 37, fields: { ...EMPTY_IDEA_FIELDS, name: "" } }).success, false);
});
