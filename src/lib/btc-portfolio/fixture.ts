import { newEvent } from "./engine";
import type { Ledger, PortfolioEvent } from "./schema";

export const MOCK_START = "2025-12-31T13:00:00.000Z";
export const MOCK_END = "2026-11-13T13:00:00.000Z";
const day = (n: number) => new Date(Date.parse(MOCK_START) + n * 86400000).toISOString();

/** Entirely invented prices and executions. No exchange, wallet or strategy data is read. */
export function makeMockLedger(): Ledger {
  const marks: Ledger["marks"] = [];
  for (let n = 0; n <= 317; n++) {
    const cycle = Math.sin(n / 17) * .055 + Math.sin(n / 5.5) * .013;
    const correction = -.19 * Math.exp(-(((n - 170) / 29) ** 2));
    for (const [asset, base, slope] of [["BTC", 90000, .00145], ["ETH", 2900, .0016], ["SOL", 150, .0021]] as const) {
      marks.push({ asset, at: day(n), price: (base * (1 + n * slope + cycle + correction)).toFixed(6) });
    }
  }
  const events: PortfolioEvent[] = [];
  function add(id: string, n: number, kind: PortfolioEvent["kind"], account: PortfolioEvent["account"], asset: PortfolioEvent["asset"], quantity: string, reason: string, extra: Partial<PortfolioEvent> = {}) {
    const price = asset === "USDT" ? "1" : marks.find(m => m.asset === asset && m.at === day(n))!.price;
    events.push({ ...newEvent(day(n)), id, kind, account, asset, quantity, price, publicReason: reason, sequence: events.length, sourceId: `fictional:${id}`, ...extra });
  }
  add("opening-cold", 0, "opening", "cold", "BTC", "0.65", "Long-term Bitcoin reserve.");
  add("opening-btc", 0, "opening", "margin", "BTC", "0.1", "Trading account opening inventory.");
  add("opening-eth", 0, "opening", "margin", "ETH", "3", "Diversified opening allocation.");
  add("opening-cash", 0, "opening", "margin", "USDT", "30000", "Cash reserve for staged entries and margin costs.");
  add("first-long", 20, "margin-open", "margin", "BTC", "0.3", "Added measured Bitcoin exposure after a higher-timeframe reclaim.", { positionId: "btc-winter", fee: "25" });
  add("winter-trim", 80, "margin-close", "margin", "BTC", "0.15", "Reduced leverage into strength while retaining the core position.", { positionId: "btc-winter", fee: "15" });
  add("winter-close", 110, "margin-close", "margin", "BTC", "0.15", "Closed the remaining tactical position and rebuilt the reserve.", { positionId: "btc-winter", fee: "15" });
  add("external-capital", 120, "deposit", "margin", "USDT", "5000", "Added capital to the trading reserve; excluded from investment return.");
  add("risk-off", 140, "sell", "margin", "ETH", "1", "Reduced altcoin exposure ahead of a weaker market phase.", { fee: "6" });
  add("cold-transfer", 150, "transfer", "margin", "BTC", "0.02", "Moved part of the existing Bitcoin allocation into Cold Storage.", { fee: "0.00002", feeAsset: "BTC" });
  add("summer-long", 175, "margin-open", "margin", "BTC", "0.75", "Increased Bitcoin exposure after the correction, keeping a cash buffer.", { positionId: "btc-summer", fee: "65", leverage: 3 });
  add("summer-partial", 250, "margin-close", "margin", "BTC", "0.1", "Realised part of the recovery and kept the rest of the trend position.", { positionId: "btc-summer", fee: "12" });
  add("eth-long", 270, "margin-open", "margin", "ETH", "4", "Added a smaller relative-strength position alongside the Bitcoin core.", { positionId: "eth-autumn", fee: "10", leverage: 2 });
  for (let n = 278; n <= 307; n++) add(`dca-${n}`, n, "buy", "margin", "BTC", (100 / Number(marks.find(m => m.asset === "BTC" && m.at === day(n))!.price)).toFixed(10), "Accumulating Bitcoin gradually rather than choosing a single entry.", { campaignId: "btc-dca", fee: "0.2" });
  for (let n = 30; n <= 300; n += 30) add(`financing-${n}`, n, "fee", "margin", "USDT", n > 175 ? "90" : "30", "Recorded financing cost for the tactical margin allocation.");
  return { mode: "mock", currency: "USDT", inceptionAt: MOCK_START, asOf: MOCK_END, events, marks,
    campaigns: [{ id: "btc-dca", name: "Build the Bitcoin reserve", asset: "BTC", startAt: day(278), durationDays: 90, cadenceDays: 1, amount: "100", status: "active", reason: "Steady accumulation while maintaining room for discretionary trades." }] };
}
