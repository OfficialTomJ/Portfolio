import { z } from "zod";
import { publicSchema, type Ledger, type PublicPortfolio } from "./schema";
import { marketAssets, MARKET_STALE_MS, type MarketAsset, type MarketQuote } from "./market-prices";
import { visitorPortfolio } from "./visitor-projection";

export const valuationBasisSchema = z.object({ asOf: z.iso.datetime({ offset: true }), prices: z.partialRecord(z.enum(marketAssets), z.number().finite().positive()) }).strict();
export type ValuationBasis = z.infer<typeof valuationBasisSchema>;

/** Relative weights and public unit prices suffice: no account balances or quantities are needed. */
export function valuationAssets(data: PublicPortfolio): MarketAsset[] {
  if (data.currency !== "USD" || !data.points.length || data.points.at(-1)!.at !== data.asOf) throw new Error("A complete USD valuation is required.");
  for (const row of data.allocation) {
    if (row.type === "margin" || row.direction !== "long" || row.weight < 0 ||
      (row.type === "cash" ? row.asset !== "USD" : !marketAssets.includes(row.asset as MarketAsset))) throw new Error("Live valuation requires supported spot holdings and USD cash.");
  }
  const total = data.allocation.reduce((sum, row) => sum + row.weight, 0);
  const invested = data.allocation.filter(row => row.type !== "cash").reduce((sum, row) => sum + row.weight, 0);
  if (Math.abs(total - 100) > 1e-6 || Math.abs(invested - data.investedPct) > 1e-6 || Math.abs(100 - invested - data.cashPct) > 1e-6) throw new Error("Allocation must reconcile to portfolio equity.");
  return marketAssets.filter(asset => asset === "BTC" || data.allocation.some(row => row.type === "spot" && row.asset === asset && row.weight > 0));
}

/** Capture the exact prices used by the accepted ledger, never substitute a later historical price. */
export function createValuationBasis(data: PublicPortfolio, ledger: Ledger): ValuationBasis {
  if (ledger.asOf !== data.asOf) throw new Error("Ledger and public valuation must match.");
  const prices: ValuationBasis["prices"] = {};
  for (const asset of valuationAssets(data)) {
    const mark = ledger.marks.filter(row => row.asset === asset && row.at <= data.asOf).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
    if (!mark || Date.parse(data.asOf) - Date.parse(mark.at) > 36 * 3600_000) throw new Error("Missing accepted valuation price.");
    prices[asset] = Number(mark.price);
  }
  return valuationBasisSchema.parse({ asOf: data.asOf, prices });
}

/** Always reprice the supplied snapshot; repeated ticks never compound a price move twice. */
export function revaluePortfolio(input: PublicPortfolio, quotes: Partial<Record<MarketAsset, MarketQuote>>, now = Date.now()): PublicPortfolio {
  const data = visitorPortfolio(input), valuation = data.valuation;
  if (!valuation) throw new Error("Missing live valuation basis.");
  const requested = valuationAssets(data), prices: ValuationBasis["prices"] = {};
  const times: number[] = [];
  for (const asset of requested) {
    const quote = quotes[asset], time = Date.parse(quote?.at ?? ""), base = valuation.prices[asset];
    if (!base || !quote || quote.asset !== asset || quote.currency !== "USD" || !Number.isFinite(quote.price) || quote.price <= 0 ||
      !Number.isFinite(time) || now - time > MARKET_STALE_MS || time > now + 60_000 || time < Date.parse(data.asOf)) throw new Error("Missing, stale or out-of-order valuation price.");
    prices[asset] = quote.price; times.push(time);
  }
  const factor = (asset: string) => prices[asset as MarketAsset]! / valuation.prices[asset as MarketAsset]!;
  const values = data.allocation.map(row => row.weight * (row.type === "cash" ? 1 : factor(row.asset)));
  const growth = values.reduce((sum, value) => sum + value, 0) / 100;
  if (!Number.isFinite(growth) || growth <= 0) throw new Error("Invalid portfolio valuation.");
  const asOf = new Date(Math.min(...times)).toISOString(), last = data.points.at(-1)!;
  const allocation = data.allocation.map((row, i) => ({ ...row, weight: values[i] / growth }));
  const investedPct = allocation.filter(row => row.type !== "cash").reduce((sum, row) => sum + row.weight, 0);
  // Replace the provisional endpoint, preserving every accepted historical point exactly.
  const points = data.points.filter(point => point.at <= valuation.holdingsAsOf);
  const endpoint = { at: asOf, portfolioIndex: last.portfolioIndex * growth, btcIndex: last.btcIndex * factor("BTC"), weights: {} };
  if (points.at(-1)?.at === asOf) points[points.length - 1] = endpoint; else points.push(endpoint);
  return publicSchema.parse({ ...data, asOf, points, allocation, investedPct, netPct: investedPct,
    cashPct: allocation.filter(row => row.type === "cash").reduce((sum, row) => sum + row.weight, 0),
    valuation: { ...valuation, status: "live", prices },
  });
}
