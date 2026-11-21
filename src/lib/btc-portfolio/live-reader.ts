import { revaluePortfolio, valuationAssets, valuationBasisSchema } from "./live-valuation";
import type { MarketAsset, MarketQuote } from "./market-prices";
import type { PublicPortfolio } from "./schema";

/** Keep last-good state scoped to a release; replacing/rolling back a release invalidates its live data. */
export function createLivePortfolioReader(options: {
  readRelease: () => Promise<{ id: string; data: PublicPortfolio }>;
  readBasis: (id: string) => Promise<unknown>;
  quote: (asset: MarketAsset) => Promise<MarketQuote>;
  now?: () => number;
}) {
  let lastGood: { id: string; data: PublicPortfolio } | undefined;
  return async () => {
    const { id, data } = await options.readRelease();
    let base = data;
    try {
      const basis = valuationBasisSchema.parse(await options.readBasis(id));
      if (basis.asOf !== data.asOf) throw new Error("Valuation basis does not match the accepted release.");
      base = { ...data, valuation: { method: "market-prices", status: "delayed", holdingsAsOf: data.asOf, prices: basis.prices } };
      const quotes = await Promise.all(valuationAssets(base).map(options.quote));
      const current = revaluePortfolio(base, Object.fromEntries(quotes.map(row => [row.asset, row])), options.now?.());
      if (lastGood?.id === id && lastGood.data.asOf > current.asOf) return lastGood.data;
      lastGood = { id, data: current };
      return current;
    } catch {
      const previous = lastGood?.id === id ? lastGood.data : base;
      return { ...previous, valuation: { method: "market-prices" as const, status: "delayed" as const,
        holdingsAsOf: data.asOf, prices: previous.valuation?.prices ?? {} } };
    }
  };
}
