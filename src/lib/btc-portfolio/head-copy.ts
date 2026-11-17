import type { PublicPortfolio } from "./schema";
import { periodPoints, pct } from "./view";

export const PORTFOLIO_NAME = "Chronicles Public Portfolio";

/** Shared by server metadata and the live browser title; only public YTD returns. */
export function portfolioHeadCopy(performance: { year: number; usdReturn: number } | null) {
  return {
    title: performance ? `${PORTFOLIO_NAME} | ${pct(performance.usdReturn)} YTD` : PORTFOLIO_NAME,
    description: "A personal journal of past portfolio performance and market commentary. For information only; not financial advice.",
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
