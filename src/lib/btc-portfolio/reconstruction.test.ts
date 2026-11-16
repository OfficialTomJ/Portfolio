import test from "node:test";
import assert from "node:assert/strict";
import { firstPriceTouch, reconstructSpotPortfolio, type DailyBar, type ReconstructionPlan } from "./reconstruction";
import { metrics } from "./view";

const at = (day: number, hour = "00") => `2026-01-${String(day).padStart(2, "0")}T${hour}:00:00.000Z`;
function samplePlan(): ReconstructionPlan {
  const bars: DailyBar[] = [];
  for (let day = 1; day <= 20; day++) {
    bars.push({ asset: "BTC", at: at(day), open: "100", high: "101", low: "99", close: "100" });
    const price = day < 7 ? "10" : day < 10 ? "20" : "30";
    bars.push({ asset: "HYPE", at: at(day), open: price, high: String(Number(price) + 1), low: String(Number(price) - 1), close: price });
  }
  const plan: ReconstructionPlan = { inceptionAt: at(1), asOf: at(20), targetAt: at(15), targetBtcFraction: "0.5", bars, actions: [
    { id: "initial", at: at(1, "12"), asset: "BTC", price: "100", kind: "buy-target", fraction: "0.2", reason: "Initial allocation.", provenance: "Synthetic test" },
    { id: "alternative", at: at(2, "12"), asset: "HYPE", price: "10", kind: "buy-fraction", fraction: "0.2", reason: "Alternative allocation.", provenance: "Synthetic test" },
    { id: "partial", at: at(8, "12"), asset: "HYPE", price: "20", kind: "sell-fraction", fraction: "0.5", reason: "Partial exit.", provenance: "Synthetic test" },
    { id: "final", at: at(11, "12"), asset: "HYPE", price: "30", kind: "sell-all", reason: "Final exit.", provenance: "Synthetic test" },
    { id: "later", at: at(16, "12"), asset: "BTC", price: "100", kind: "buy-fraction", fraction: "0.2", reason: "Later allocation.", provenance: "Synthetic test" },
  ] };
  for (const day of [3, 5, 7, 9, 12]) plan.actions.push({ id: `dca-${day}`, at: at(day, "12"), asset: "BTC", kind: "dca", reason: "Staged accumulation.", provenance: "Synthetic test" });
  return plan;
}
test("normalized USD reconstruction calibrates the allocation without margin or cash creation", () => {
  const r = reconstructSpotPortfolio(samplePlan()), m = metrics(r.replay.publicData.points)!;
  assert.ok(Math.abs(r.targetAllocationPct - 50) < .00001);
  assert.ok(Math.abs(m.portfolio - 30) < .00001);
  assert.ok(Math.abs(r.replay.publicData.investedPct - 70) < .00001);
  assert.ok(Math.abs(r.replay.publicData.cashPct - 30) < .00001);
  assert.equal(r.replay.publicData.mode, "reconstructed"); assert.equal(r.replay.publicData.currency, "USD");
  assert.equal(r.ledger.campaigns[0].status, "completed");
  assert.ok(r.ledger.events.every(e => !e.kind.startsWith("margin-")));
  assert.ok(r.replay.publicData.points.every(p => Math.abs(Object.values(p.weights).reduce((s, v) => s + v, 0) - 100) < .000001));
});
test("first-touch inference respects the allowed chronology instead of choosing profitable dates", () => {
  const bars = samplePlan().bars;
  assert.equal(firstPriceTouch(bars, "BTC", "100", at(3), at(10)), at(3, "12"));
  assert.throws(() => firstPriceTouch(bars, "BTC", "500", at(1), at(20)), /No sourced/);
});
