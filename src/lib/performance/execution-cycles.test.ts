import assert from "node:assert/strict";
import test from "node:test";
import { reconstructClosedExecutionCycles, isWithinCycleBoundary } from "./execution-cycles";
import type { BybitExecution } from "./bybit";

const start = Date.parse("2026-01-01T00:00:00Z");
function fill(id: string, side: "Buy" | "Sell", quantity: number, closedSize: number, minute: number, overrides: Partial<BybitExecution> = {}): BybitExecution {
  return { execId: id, orderId: id, orderLinkId: "", symbol: "BTCUSDT", side, execQty: String(quantity), closedSize: String(closedSize), execTime: String(start + minute * 60000), execPrice: "100", execValue: "100", execFee: "0", execType: "Trade", orderType: "Market", stopOrderType: "", seq: minute, ...overrides };
}
function recover(fills: BybitExecution[], index = 0) { return reconstructClosedExecutionCycles(fills, new Map(fills.map(f => [f.orderId, index]))); }
test("separates two same-direction trades even when neither was seen open", () => {
  const cycles = recover([fill("s1", "Sell", 1, 0, 1), fill("c1", "Buy", 1, 1, 2), fill("s2", "Sell", 2, 0, 3), fill("c2", "Buy", 2, 2, 4)]);
  assert.equal(cycles.length, 2);
  assert.deepEqual(cycles.map(c => c.closingOrderIds), [["c1"], ["c2"]]);
  assert.equal(cycles[1].openedAt.getTime(), start + 180000);
});
test("a flat boundary still separates two ideas opened less than a second apart", () => {
  const cycles = recover([fill("s1", "Sell", 1, 0, 1), fill("c1", "Buy", 1, 1, 1, { execTime: String(start + 60100) }), fill("s2", "Sell", 1, 0, 1, { execTime: String(start + 60200) }), fill("c2", "Buy", 1, 1, 1, { execTime: String(start + 60300) })]);
  assert.equal(cycles.length, 2);
  assert.notEqual(cycles[0].openedAt.getTime(), cycles[1].openedAt.getTime());
});
test("retains scale-ins and partial profit-taking in one continuous position", () => {
  const cycles = recover([fill("e1", "Buy", 10, 0, 1), fill("e2", "Buy", 5, 0, 2), fill("p", "Sell", 5, 5, 3), fill("end", "Sell", 10, 10, 4)]);
  assert.equal(cycles.length, 1);
  assert.deepEqual(cycles[0].openingOrderIds, ["e1", "e2"]);
  assert.deepEqual(cycles[0].closingOrderIds, ["end", "p"]);
});
test("ignores funding and incomplete leading history; open positions are not recovered as closed", () => {
  const cycles = recover([fill("orphan", "Sell", 1, 1, 1), fill("entry", "Buy", 1, 0, 2), fill("fund", "Buy", 1, 0, 3, { execType: "Funding" }), fill("end", "Sell", 1, 1, 4), fill("active", "Buy", 1, 0, 5)]);
  assert.equal(cycles.length, 1);
  assert.deepEqual(cycles[0].openingOrderIds, ["entry"]);
});
test("deduplicates fills, rejects conflicts, and is independent of input ordering", () => {
  const entries = [fill("entry", "Sell", 1, 0, 1), fill("end", "Buy", 1, 1, 2)];
  assert.deepEqual(recover([...entries].reverse().concat(entries[0])), recover(entries));
  assert.throws(() => recover([...entries, { ...entries[0], execQty: "2" }]), /Conflicting/);
});
test("handles a reversal using its closed-size portion without merging opposite ideas", () => {
  const cycles = recover([fill("long", "Buy", 1, 0, 1), fill("reverse", "Sell", 3, 1, 2), fill("end", "Buy", 2, 2, 3)]);
  assert.equal(cycles.length, 2);
  assert.deepEqual(cycles.map(c => c.direction), ["Long", "Short"]);
  assert.deepEqual(cycles.map(c => c.quantity), [1, 2]);
});
test("uses position index to keep hedged long and short streams separate", () => {
  const fills = [fill("l", "Buy", 1, 0, 1), fill("s", "Sell", 2, 0, 2), fill("lc", "Sell", 1, 1, 3), fill("sc", "Buy", 2, 2, 4)];
  const cycles = reconstructClosedExecutionCycles(fills, new Map([["l", 1], ["lc", 1], ["s", 2], ["sc", 2]]));
  assert.deepEqual(cycles.map(c => c.positionIdx), [1, 2]);
});
test("does not invent a position index or recover a cycle through unknown-order history", () => {
  const fills = [fill("a", "Buy", 1, 0, 1), fill("unknown", "Buy", 1, 0, 2), fill("end", "Sell", 2, 2, 3)];
  assert.deepEqual(reconstructClosedExecutionCycles(fills, new Map([["a", 0], ["end", 0]])), []);
});
test("a closed trade cannot absorb subsequent PnL through legacy fallback", () => {
  const cycle = { openedAt: new Date(start), closedAt: new Date(start + 60000) };
  assert.equal(isWithinCycleBoundary(cycle, new Date(start + 60000)), true);
  assert.equal(isWithinCycleBoundary(cycle, new Date(start + 120000)), false);
  assert.equal(isWithinCycleBoundary({ ...cycle, executionClosedAt: new Date(start + 30000) }, new Date(start + 60000)), false);
});
