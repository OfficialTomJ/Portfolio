import assert from "node:assert/strict";
import test from "node:test";
import { excludedTradeIds, publicTradeIdForCycle } from "./publication";

test("a cycle exception targets only its own deterministic public trade", () => {
  const first = "account-test:demo:linear:HYPEUSDT:0:1790199973711";
  const second = "account-test:demo:linear:HYPEUSDT:0:1790324750667";
  const excluded = excludedTradeIds([{ _id: second }]);

  assert.equal(excluded.has(publicTradeIdForCycle(second)), true);
  assert.equal(excluded.has(publicTradeIdForCycle(first)), false);
});
