import Decimal from "decimal.js";
import { newEvent, replayPortfolio, PortfolioInputError } from "./engine";
import type { Ledger, PortfolioEvent } from "./schema";

type Asset = "BTC" | "HYPE";
export interface DailyBar { asset: Asset; at: string; open: string; high: string; low: string; close: string }
export interface ReconstructionAction {
  id: string; at: string; asset: Asset; price?: string; kind: "buy-target" | "buy-fraction" | "sell-fraction" | "sell-all" | "dca";
  fraction?: string; reason: string; provenance: string;
}
export interface ReconstructionPlan {
  inceptionAt: string; asOf: string; targetAt: string; targetBtcFraction: string;
  actions: ReconstructionAction[]; bars: DailyBar[];
}
const D = Decimal.clone({ precision: 40 });
/** Date inference is deterministic, constrained by the owner's chronology, and never optimizes returns. */
export function firstPriceTouch(bars: DailyBar[], asset: Asset, price: string, from: string, through: string) {
  const p = new D(price);
  const bar = [...bars].sort((a, b) => a.at.localeCompare(b.at)).find(b => b.asset === asset && b.at >= from && b.at <= through && new D(b.low).lte(p) && new D(b.high).gte(p));
  if (!bar) throw new PortfolioInputError(`No sourced daily candle supports the ${asset} price in the allowed period.`);
  return `${bar.at.slice(0, 10)}T12:00:00.000Z`;
}

/** Normalized spot-only reconstruction. The opening 100 units are a model scale, never actual capital. */
export function reconstructSpotPortfolio(plan: ReconstructionPlan) {
  const start = Date.parse(plan.inceptionAt), end = Date.parse(plan.asOf), targetTime = Date.parse(plan.targetAt);
  const marks: Ledger["marks"] = [];
  for (const bar of plan.bars) {
    const closeAt = Date.parse(bar.at) + 86400000;
    if (closeAt <= end && closeAt >= start) marks.push({ asset: bar.asset, at: new Date(closeAt).toISOString(), price: bar.close });
  }
  const startBar = plan.bars.find(b => b.asset === "BTC" && Date.parse(b.at) === start);
  if (!startBar) throw new PortfolioInputError("The benchmark needs a sourced opening mark.");
  if (!marks.some(m => m.asset === "BTC" && Date.parse(m.at) === start)) marks.push({ asset: "BTC", at: plan.inceptionAt, price: startBar.open });
  const order = [...plan.actions].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  if (order.some(a => Date.parse(a.at) < start || Date.parse(a.at) > end)) throw new PortfolioInputError("An inferred action falls outside the reconstruction.");
  const marketAt = (asset: Asset, at: string) => {
    const time = Date.parse(at);
    const mark = marks.filter(m => m.asset === asset && Date.parse(m.at) <= time).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
    if (!mark || time - Date.parse(mark.at) > 36 * 3600000) throw new PortfolioInputError(`Missing completed daily ${asset} mark.`);
    return new D(mark.price);
  };
  const targetMark = marketAt("BTC", plan.targetAt);
  function build(intervalSpend: Decimal) {
    let cash = new D(100), btc = new D(0), hype = new D(0), originalHype = new D(0), checkpoint: Decimal | null = null;
    const events: PortfolioEvent[] = [{ ...newEvent(plan.inceptionAt), id: "normalized-opening", kind: "opening", asset: "USD", quantity: "100", price: "1", feeAsset: "USD", publicReason: "Began the year in cash while waiting for accumulation opportunities.", privateNote: "Normalized 100 model units; not the owner's actual money or quantity.", sourceId: "reconstruction:opening" }];
    for (const action of order) {
      if (checkpoint === null && Date.parse(action.at) > targetTime) checkpoint = btc.mul(targetMark).div(cash.plus(btc.mul(targetMark)).plus(hype.mul(hype.eq(0) ? 0 : marketAt("HYPE", plan.targetAt))));
      const px = action.price ? new D(action.price) : marketAt(action.asset, action.at);
      const btcMark = action.asset === "BTC" ? px : marketAt("BTC", action.at);
      const hypeMark = hype.eq(0) ? new D(0) : action.asset === "HYPE" ? px : marketAt("HYPE", action.at);
      const equity = cash.plus(btc.mul(btcMark)).plus(hype.mul(hypeMark));
      const held = action.asset === "BTC" ? btc : hype;
      let quantity: Decimal;
      const buy = ["buy-target", "buy-fraction", "dca"].includes(action.kind);
      if (action.kind === "dca") quantity = intervalSpend.div(px);
      else if (action.kind === "buy-target") quantity = equity.mul(action.fraction!).minus(held.mul(px)).div(px);
      else if (action.kind === "buy-fraction") quantity = equity.mul(action.fraction!).div(px);
      else if (action.kind === "sell-fraction") quantity = (action.asset === "HYPE" ? originalHype : held).mul(action.fraction!);
      else quantity = held;
      quantity = new D(quantity.toFixed(12, Decimal.ROUND_DOWN));
      if (!quantity.gt(0)) throw new PortfolioInputError("The reconstruction produced a non-positive fill.");
      cash = cash.plus(quantity.mul(px).mul(buy ? -1 : 1));
      if (action.asset === "BTC") btc = btc.plus(quantity.mul(buy ? 1 : -1)); else { hype = hype.plus(quantity.mul(buy ? 1 : -1)); if (buy) originalHype = originalHype.plus(quantity); }
      if (cash.lt(0) || btc.lt(0) || hype.lt(0)) throw new PortfolioInputError("This reconstruction would require borrowing. Revise the assumptions.");
      events.push({ ...newEvent(action.at), id: action.id, kind: buy ? "buy" : "sell", account: "margin", asset: action.asset, quantity: quantity.toFixed(), price: px.toFixed(), feeAsset: "USD", fee: "0", leverage: 1, sequence: events.length,
        publicReason: action.reason, campaignId: action.kind === "dca" ? "historical-dca" : "", privateNote: `Estimated execution: ${action.provenance}. Model quantities are normalized, not actual position sizes.`, sourceId: `reconstruction:${action.id}` });
    }
    if (checkpoint === null) checkpoint = btc.mul(targetMark).div(cash.plus(btc.mul(targetMark)).plus(hype.mul(hype.eq(0) ? 0 : marketAt("HYPE", plan.targetAt))));
    return { events, checkpoint };
  }
  // Calibrate a constant weekly spend to the owner's reported end-of-DCA allocation, not to maximize PnL.
  let low = new D("0.0000001"), high = new D(100);
  for (let i = 0; i < 55; i++) {
    const mid = low.plus(high).div(2);
    try { const candidate = build(mid); if (candidate.checkpoint.lt(plan.targetBtcFraction)) low = mid; else high = mid; }
    catch (e) { if (!(e instanceof PortfolioInputError)) throw e; high = mid; }
  }
  const spend = low.plus(high).div(2), built = build(spend);
  if (built.checkpoint.minus(plan.targetBtcFraction).abs().gt("0.00001")) throw new PortfolioInputError("Cannot reach the reported allocation without borrowing under these assumptions.");
  for (const e of built.events) if (e.kind !== "opening") {
    const existing = marks.findIndex(m => m.asset === e.asset && m.at === e.at);
    const mark = { asset: e.asset, at: e.at, price: e.price };
    if (existing < 0) marks.push(mark); else marks[existing] = mark;
  }
  const dca = order.filter(a => a.kind === "dca");
  const ledger: Ledger = { mode: "reconstructed", currency: "USD", inceptionAt: plan.inceptionAt, asOf: plan.asOf,
    campaigns: dca.length ? [{ id: "historical-dca", name: "Historical Bitcoin accumulation", asset: "BTC", startAt: dca[0].at, durationDays: Math.ceil((Date.parse(dca.at(-1)!.at) - Date.parse(dca[0].at)) / 86400000) + 1, cadenceDays: 7, amount: spend.toFixed(12), status: "completed", reason: "Built the Bitcoin allocation gradually, then stopped scheduled accumulation." }] : [], marks, events: built.events };
  const replay = replayPortfolio(ledger);
  for (const p of replay.publicData.points) {
    const total = Object.values(p.weights).reduce((s, value) => s + value, 0);
    if (Math.abs(total - 100) > .000001 || Object.entries(p.weights).filter(([a]) => a !== "USD").reduce((s, [, v]) => s + v, 0) > 100.000001) throw new PortfolioInputError("Spot-only allocation failed its no-borrowing check.");
  }
  return { ledger, replay, normalizedIntervalSpend: spend.toString(), targetAllocationPct: built.checkpoint.mul(100).toNumber() };
}
