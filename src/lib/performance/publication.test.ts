import assert from "node:assert/strict";
import test from "node:test";
import { excludedTradeIds, publicTradeIdForCycle } from "./publication";

test("journal eligibility targets only the matching position cycle", () => {
  const first = "account-test:demo:linear:BTCUSDT:0:1700000000000";
  const second = "account-test:demo:linear:BTCUSDT:0:1700003600000";
  const excluded = excludedTradeIds([{ _id: second }]);

  assert.equal(excluded.has(publicTradeIdForCycle(second)), true);
  assert.equal(excluded.has(publicTradeIdForCycle(first)), false);
});
