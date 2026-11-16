import Decimal from "decimal.js";
import { assets, ledgerSchema, publicSchema, type Account, type Ledger, type PortfolioEvent, type ReplayResult } from "./schema";

const D = Decimal.clone({ precision: 40 });
export class PortfolioInputError extends Error {}
const fail = (s: string): never => { throw new PortfolioInputError(s); };
type Position = { id: string; asset: string; quantity: Decimal; entry: Decimal; direction: "long" | "short"; leverage: number };

/** Margin is represented as spot balances plus net position PnL. Notional/collateral never add equity. */
export function replayPortfolio(input: Ledger): ReplayResult {
  const ledger = ledgerSchema.parse(input), start = Date.parse(ledger.inceptionAt), end = Date.parse(ledger.asOf), cashAsset = ledger.currency;
  if (end <= start) fail("The cutoff must follow inception.");
  const all = ledger.events;
  if (new Set(all.map(e => e.id)).size !== all.length) fail("Duplicate event ID.");
  const sources = all.filter(e => e.sourceId).map(e => e.sourceId);
  if (new Set(sources).size !== sources.length) fail("Duplicate source record. Review the import.");
  const events = all.filter(e => !e.voided).sort((a, b) => a.at.localeCompare(b.at) || a.sequence - b.sequence || a.id.localeCompare(b.id));
  const marks = new Map<string, { time: number; price: Decimal }[]>();
  for (const m of ledger.marks) {
    const list = marks.get(m.asset) ?? [], time = Date.parse(m.at);
    if (list.some(p => p.time === time)) fail(`Duplicate ${m.asset} price mark.`);
    list.push({ time, price: new D(m.price) }); marks.set(m.asset, list);
  }
  for (const series of marks.values()) series.sort((a, b) => a.time - b.time);
  const price = (asset: string, time: number): Decimal => {
    if (asset === cashAsset) return new D(1);
    const list = marks.get(asset) ?? [];
    let lo = 0, hi = list.length - 1, found = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid].time <= time) { found = mid; lo = mid + 1; } else hi = mid - 1; }
    if (found < 0 || time - list[found].time > 36 * 3600000) return fail(`Missing or stale ${asset} mark at ${new Date(time).toISOString()}.`);
    return list[found].price;
  };
  const balances = new Map<string, Decimal>(), positions = new Map<string, Position>();
  const key = (account: Account, asset: string) => `${account}:${asset}`;
  const qty = (account: Account, asset: string) => balances.get(key(account, asset)) ?? new D(0);
  const change = (account: Account, asset: string, delta: Decimal) => {
    if (account === "cold" && asset !== "BTC") fail("Cold Storage supports BTC only in this mock.");
    const next = qty(account, asset).plus(delta);
    if (next.lt(0)) fail(`Insufficient ${asset} in ${account === "cold" ? "Cold Storage" : "Margin Account"}.`);
    balances.set(key(account, asset), next);
  };
  const positionPnl = (p: Position, time: number) => price(p.asset, time).minus(p.entry).mul(p.quantity).mul(p.direction === "long" ? 1 : -1);
  const nav = (time: number) => [...balances].reduce((sum, [k, q]) => q.eq(0) ? sum : sum.plus(q.mul(price(k.split(":")[1], time))), new D(0))
    .plus([...positions.values()].reduce((s, p) => s.plus(positionPnl(p, time)), new D(0)));
  const exposure = (asset: string, account: Account, time: number) => {
    const owned = qty(account, asset), active = account === "margin" ? [...positions.values()].filter(p => p.asset === asset) : [];
    if (owned.eq(0) && !active.length) return new D(0);
    return owned.plus(active.reduce((s, p) => s.plus(p.quantity.mul(p.direction === "long" ? 1 : -1)), new D(0))).mul(price(asset, time));
  };
  const combinedCash = (time: number) => ["USD", "USDT"].reduce((sum, asset) => qty("margin", asset).eq(0) ? sum : sum.plus(qty("margin", asset).mul(price(asset, time))), new D(0));
  const allocationWeights = (time: number, equity: Decimal) => new Map([
    ...(["BTC", "ETH", "SOL", "HYPE"] as const).map(asset => [asset, exposure(asset, "cold", time).plus(exposure(asset, "margin", time)).div(equity).mul(100)] as const),
    ["CASH", combinedCash(time).div(equity).mul(100)] as const,
  ]);
  const openingKeys = new Set<string>();
  for (const e of events) {
    if (Date.parse(e.at) < start || Date.parse(e.at) > end) fail("Every event must fall within the replay period.");
    if (e.kind === "opening") {
      if (Date.parse(e.at) !== start || openingKeys.has(key(e.account, e.asset))) fail("Use one opening balance per asset/account at inception.");
      if (e.fee !== "0" && !new D(e.fee).eq(0)) fail("Opening balances cannot have fees.");
      openingKeys.add(key(e.account, e.asset)); change(e.account, e.asset, new D(e.quantity));
    }
  }
  // Positions opened exactly at inception are ordinary executions; prior positions can use their historical entry.
  const openingEquity = nav(start);
  if (!openingEquity.gt(0)) fail("Add positive opening balances.");
  let units = openingEquity.div(100), contributions = new D(0), fees = new D(0), financing = new D(0), realised = new D(0), transfers = 0;
  const btcStart = price("BTC", start), points: ReplayResult["publicData"]["points"] = [], activity: ReplayResult["publicData"]["activity"] = [];
  let passiveBtc: Decimal | null = openingEquity.div(btcStart);
  const timeline = [...new Set([start, end, ...ledger.marks.map(m => Date.parse(m.at)), ...events.map(e => Date.parse(e.at))])].filter(t => t >= start && t <= end).sort((a, b) => a - b);
  let cursor = 0;
  const initialPoint = { at: ledger.inceptionAt, portfolioIndex: 100, btcIndex: 100, weights: {} };
  points.push(initialPoint);
  for (const time of timeline) {
    while (cursor < events.length && Date.parse(events[cursor].at) === time) {
      const e = events[cursor++];
      if (e.kind === "opening") continue;
      const q = new D(e.quantity), px = new D(e.price), before = nav(time);
      if (!before.gt(0)) fail("Equity reached zero or negative. Start a separately reviewed tracking segment.");
      const beforeWeight = exposure(e.asset, e.account, time).div(before).mul(100).toNumber();
      const allocationBefore = allocationWeights(time, before);
      let flow = new D(0);
      if (["buy", "sell", "margin-open", "margin-close"].includes(e.kind) && (e.account !== "margin" || ["USDT", "USD"].includes(e.asset))) fail("Trades must use a non-cash asset in Margin Account.");
      if (e.kind === "buy") { change("margin", cashAsset, q.mul(px).neg()); change("margin", e.asset, q); }
      if (e.kind === "sell") { change("margin", e.asset, q.neg()); change("margin", cashAsset, q.mul(px)); }
      if (e.kind === "transfer") {
        if (e.asset !== "BTC") fail("Internal transfers support BTC only in this mock.");
        const beforeTransfer = nav(time);
        change(e.account, e.asset, q.neg()); change(e.account === "cold" ? "margin" : "cold", e.asset, q);
        if (!nav(time).eq(beforeTransfer)) fail("Internal transfer failed conservation.");
        transfers++;
      }
      if (e.kind === "deposit" || e.kind === "withdrawal") {
        flow = q.mul(price(e.asset, time)).mul(e.kind === "deposit" ? 1 : -1);
        if (!before.plus(flow).gt(0)) fail("Full withdrawal requires a new tracking segment.");
        units = units.plus(flow.div(before.div(units))); contributions = contributions.plus(flow);
        if (passiveBtc) { passiveBtc = passiveBtc.plus(flow.div(price("BTC", time))); if (passiveBtc.lt(0)) passiveBtc = null; }
        change(e.account, e.asset, q.mul(e.kind === "deposit" ? 1 : -1));
      }
      if (e.kind === "margin-open") {
        if (!e.positionId || positions.has(e.positionId)) fail("Each margin opening needs a new position ID.");
        positions.set(e.positionId, { id: e.positionId, asset: e.asset, quantity: q, entry: px, direction: e.direction, leverage: e.leverage });
      }
      if (e.kind === "margin-close") {
        const p = positions.get(e.positionId);
        if (!p) throw new PortfolioInputError("Choose an open margin position.");
        if (p.asset !== e.asset || p.quantity.lt(q)) fail("Choose an open margin position and a valid closing quantity.");
        const result = px.minus(p.entry).mul(q).mul(p.direction === "long" ? 1 : -1);
        change("margin", cashAsset, result); realised = realised.plus(result); p.quantity = p.quantity.minus(q);
        if (p.quantity.eq(0)) positions.delete(p.id);
      }
      if (e.kind === "fee") { change(e.account, e.asset, q.neg()); financing = financing.plus(q.mul(price(e.asset, time))); }
      const fee = new D(e.fee); if (fee.gt(0)) { change(e.account, e.feeAsset, fee.neg()); fees = fees.plus(fee.mul(price(e.feeAsset, time))); }
      const after = nav(time);
      if (!after.gt(0)) fail("Equity reached zero or negative. Replay cannot continue across insolvency.");
      const allocationAfter = allocationWeights(time, after);
      const allocationChanges = [...allocationAfter].map(([asset, weight]) => ({ asset, deltaPct: weight.minus(allocationBefore.get(asset)!).toNumber() })).filter(change => Math.abs(change.deltaPct) > 1e-10);
      const campaignIndex = ledger.campaigns.findIndex(c => c.id === e.campaignId);
      if (e.campaignId && (campaignIndex < 0 || e.kind !== "buy" || ledger.campaigns[campaignIndex].asset !== e.asset)) fail("A DCA fill must match an existing plan and asset.");
      activity.push({ id: `activity-${activity.length + 1}`, at: e.at, kind: e.kind, account: e.account, asset: e.asset, reason: e.publicReason, articleUrl: e.articleUrl ? `${new URL(e.articleUrl).origin}${new URL(e.articleUrl).pathname}` : "", campaignId: campaignIndex < 0 ? "" : `plan-${campaignIndex + 1}`,
        weightBefore: beforeWeight, weightAfter: exposure(e.asset, e.account, time).div(after).mul(100).toNumber(), allocationChanges });
    }
    const equity = nav(time);
    if (!equity.gt(0)) fail("Zero or negative equity requires a new tracking segment.");
    const weights = Object.fromEntries(assets.map(a => [a, exposure(a, "cold", time).plus(exposure(a, "margin", time)).div(equity).mul(100).toNumber()]));
    const point = { at: new Date(time).toISOString(), portfolioIndex: equity.div(units).toNumber(), btcIndex: price("BTC", time).div(btcStart).mul(100).toNumber(), weights };
    if (time === start && activity.some(a => a.at === ledger.inceptionAt)) points.push(point); else if (time === start) points[0] = point; else points.push(point);
  }
  const equity = nav(end), allocation: ReplayResult["publicData"]["allocation"] = [];
  for (const [k, q] of balances) {
    const [account, asset] = k.split(":") as [Account, string];
    if (q.gt(0)) allocation.push({ account, asset, weight: q.mul(price(asset, end)).div(equity).mul(100).toNumber(), type: ["USD", "USDT"].includes(asset) ? "cash" : "spot", direction: "long" });
  }
  for (const p of positions.values()) allocation.push({ account: "margin", asset: p.asset, weight: p.quantity.mul(price(p.asset, end)).div(equity).mul(100).mul(p.direction === "long" ? 1 : -1).toNumber(), type: "margin", direction: p.direction });
  const cash = combinedCash(end), unrealised = [...positions.values()].reduce((s, p) => s.plus(positionPnl(p, end)), new D(0));
  const initialMargin = [...positions.values()].reduce((s, p) => s.plus(p.entry.mul(p.quantity).div(p.leverage)), new D(0));
  const publicData = publicSchema.parse({ mode: ledger.mode, currency: ledger.currency, inceptionAt: ledger.inceptionAt, asOf: ledger.asOf,
    lastActivityAt: activity.at(-1)?.at ?? ledger.inceptionAt, publishedAt: null, release: 1, points, allocation,
    cashPct: cash.div(equity).mul(100).toNumber(), investedPct: allocation.filter(a => a.type !== "cash").reduce((s, a) => s + Math.abs(a.weight), 0), netPct: allocation.filter(a => a.type !== "cash").reduce((s, a) => s + a.weight, 0), activity,
    campaigns: ledger.campaigns.map((c, i) => ({ id: `plan-${i + 1}`, name: c.name, asset: c.asset, startAt: c.startAt, durationDays: c.durationDays, cadenceDays: c.cadenceDays, status: c.status, reason: c.reason, recordedFills: events.filter(e => e.kind === "buy" && e.campaignId === c.id).length })),
  });
  return { publicData, summary: { equity: equity.toString(), openingEquity: openingEquity.toString(), btcEquivalent: equity.div(price("BTC", end)).toString(), btcHeld: qty("cold", "BTC").plus(qty("margin", "BTC")).toString(), cash: cash.toString(), netContributions: contributions.toString(), pnl: equity.minus(openingEquity).minus(contributions).toString(), fees: fees.toString(), financing: financing.toString(), realised: realised.toString(), unrealised: unrealised.toString(), initialMargin: initialMargin.toString(),
    passiveBtc: passiveBtc?.toString() ?? null, passiveValue: passiveBtc?.mul(price("BTC", end)).toString() ?? null, passiveGap: passiveBtc ? equity.minus(passiveBtc.mul(price("BTC", end))).toString() : null,
    holdings: [...balances].map(([k, q]) => { const [account, asset] = k.split(":") as [Account, string]; return { account, asset, quantity: q.toString(), value: q.mul(price(asset, end)).toString() }; }),
    positions: [...positions.values()].map(p => ({ id: p.id, asset: p.asset, direction: p.direction, quantity: p.quantity.toString(), entry: p.entry.toString(), mark: price(p.asset, end).toString(), pnl: positionPnl(p, end).toString(), leverage: p.leverage })) },
    checks: [{ name: "Ledger replay", passed: true, detail: `${events.length} active events replayed; positive net equity at every boundary.` }, { name: "Internal transfers", passed: true, detail: `${transfers} paired transfers conserve equity before fees.` }, { name: "Price coverage", passed: true, detail: `Every valuation and cash-flow boundary has a preceding mark within 36 hours. ${ledger.mode === "mock" ? "Fictional daily marks only." : "Reconstructed execution marks and sourced daily market marks; intraday timing is estimated."}` }, { name: "Source uniqueness", passed: true, detail: "Event and source identifiers are unique; repeated imports are handled before replay." }, { name: "Independent actual statements", passed: false, detail: "Actual account statements, fills and fee evidence have not been reconciled. This is not an audited performance record." }],
  };
}

export function newEvent(at: string): PortfolioEvent {
  return { id: "", at, sequence: 1000, kind: "buy", account: "margin", asset: "BTC", quantity: "0.01", price: "100000", fee: "0", feeAsset: "USDT", direction: "long", leverage: 2, positionId: "", publicReason: "", privateNote: "", correctionReason: "", sourceId: "", articleUrl: "", voided: false, campaignId: "" };
}
