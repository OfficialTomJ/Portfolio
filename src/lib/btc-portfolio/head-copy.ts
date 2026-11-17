import type { PublicPortfolio } from "./schema";
import { periodPoints, pct } from "./view";

/** Shared by server metadata and the live browser title; only public YTD returns. */
export function portfolioHeadCopy(performance: { year: number; usdReturn: number } | null) {
  return {
    title: performance ? `Public Portfolio | ${pct(performance.usdReturn)} YTD (${performance.year})` : "Public Portfolio",
    description: performance
      ? `Track a public crypto portfolio returning ${pct(performance.usdReturn)} in USD year to date. Explore performance vs BTC, current allocation, and investment ideas.`
      : "Track a public crypto portfolio's performance in USD and against Bitcoin, current allocation, and investment ideas.",
  };
}

export function portfolioHeadCopyForData(data: PublicPortfolio) {
  const points = periodPoints(data, "YTD", "", "");
  if (!points.length) return portfolioHeadCopy(null);
  return portfolioHeadCopy({
    year: new Date(data.asOf).getUTCFullYear(),
    usdReturn: (points.at(-1)!.portfolioIndex / points[0].portfolioIndex - 1) * 100,
  });
}
