import assert from "node:assert/strict";
import test from "node:test";
import type { BybitClosedPnl, BybitExecution } from "./bybit";
import { closedPnlForRound, matchExecutionCycle, reconstructClosedRounds } from "./execution-rounds";

const start = Date.parse("2026-01-01T00:00:00Z");
function fill(orderId: string, side: "Buy" | "Sell", qty: number, closed: number, minute: number): BybitExecution {
  return { execId: orderId, orderId, symbol: "BTCUSDT", side, execQty: String(qty), closedSize: String(closed), execPrice: "100",
    execTime: String(start + minute * 60000), seq: minute, execType: "Trade" } as BybitExecution;
}
function pnl(orderId: string, qty: number, minute: number): BybitClosedPnl {
  return { orderId, symbol: "BTCUSDT", side: "Sell", execType: "Trade", closedSize: String(qty), qty: String(qty),
    closedPnl: "-3", updatedTime: String(start + minute * 60000), avgEntryPrice: "100", avgExitPrice: "99" } as BybitClosedPnl;
}

test("a missed between-sync re-entry is a separate round with its own closing orders", () => {
  const result = reconstructClosedRounds([fill("entry", "Buy", 2, 0, 1), fill("exit", "Sell", 2, 2, 2),
    fill("reentry", "Buy", 3, 0, 3), fill("later-exit", "Sell", 3, 3, 4)]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.rounds.length, 2);
  assert.deepEqual(result.rounds.map(r => r.closingOrderIds), [["exit"], ["later-exit"]]);
  const records = [pnl("exit", 2, 2), pnl("later-exit", 3, 4)];
  assert.deepEqual(closedPnlForRound(result.rounds[0], records)?.map(r => r.orderId), ["exit"]);
  assert.equal(result.rounds[0].closedAt.getTime(), start + 120000);
});

test("partial exits and adds stay in one continuous position until it becomes flat", () => {
  const result = reconstructClosedRounds([fill("a", "Buy", 2, 0, 1), fill("partial", "Sell", 1, 1, 2),
    fill("add", "Buy", 3, 0, 3), fill("final", "Sell", 4, 4, 4)]);
  assert.equal(result.rounds.length, 1);
  assert.equal(result.rounds[0].quantity, 5);
  assert.deepEqual(result.rounds[0].openingOrderIds, ["a", "add"]);
  assert.equal(closedPnlForRound(result.rounds[0], [pnl("partial", 1, 2), pnl("final", 4, 4)])?.length, 2);
});

test("multiple fills for one opening order and repeated execution IDs are not scale-ins", () => {
  const a = fill("a", "Buy", 1, 0, 1), b = { ...a, execId: "b", seq: 2 };
  const { rounds } = reconstructClosedRounds([a, b, a, fill("close", "Sell", 2, 2, 3)]);
  assert.equal(rounds.length, 1); assert.deepEqual(rounds[0].openingOrderIds, ["a"]);
});

test("open exposure, incomplete prefixes, reversals and inconsistent fills are not backfilled", () => {
  assert.equal(reconstructClosedRounds([fill("a", "Buy", 1, 0, 1)]).rounds.length, 0);
  assert.equal(reconstructClosedRounds([fill("tiny", "Buy", 1e-10, 0, 1)]).rounds.length, 0);
  for (const fills of [[fill("missing", "Sell", 1, 1, 1)],
    [fill("a", "Buy", 1, 0, 1), fill("reverse", "Sell", 2, 1, 2)],
    [fill("a", "Buy", 1, 0, 1), fill("hedge", "Sell", 1, 0, 2)]]) {
    const result = reconstructClosedRounds(fills);
    assert.equal(result.rounds.length, 0); assert.equal(result.issues.length, 1);
  }
});

test("missing, duplicated, wrong-side and wrong-size PnL cannot complete a round", () => {
  const round = reconstructClosedRounds([fill("a", "Buy", 2, 0, 1), fill("close", "Sell", 2, 2, 2)]).rounds[0];
  const good = pnl("close", 2, 2);
  for (const records of [[], [good, good], [pnl("close", 1, 2)], [{ ...good, side: "Buy" as const }], [pnl("different", 2, 2)]]) {
    assert.equal(closedPnlForRound(round, records), null);
  }
});

test("canonical IDs and explicit historical exclusions survive alias reconciliation", () => {
  const round = reconstructClosedRounds([fill("a", "Buy", 1, 0, 1), fill("close", "Sell", 1, 1, 2)]).rounds[0];
  const canonical = { _id: "stable", symbol: round.symbol, direction: round.direction, openedAt: new Date(round.openedAt.getTime() + 1), status: "published" };
  const alias = { ...canonical, _id: "alias", status: "excluded", excludedFromJournal: true };
  assert.equal(matchExecutionCycle(round, [alias, canonical])?._id, "stable");
  assert.equal(matchExecutionCycle(round, [alias, { ...alias, _id: "explicit", exclusionReason: "user_request" }])?._id, "explicit");
  assert.throws(() => matchExecutionCycle(round, [canonical, { ...canonical, _id: "conflicting" }]), /ambiguous/);
});
