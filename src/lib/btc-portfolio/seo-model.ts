import { createHash } from "node:crypto";
import type { PublicPortfolio } from "./schema";
import { periodPoints, pct } from "./view";
import { PORTFOLIO_NAME } from "./head-copy";

export const PORTFOLIO_CANONICAL = "https://mentor.thomas-johnston.com/portfolio";
export const PORTFOLIO_IMAGE_VERSION = 1;
export interface PortfolioSeoModel { key: string; imageDay: string; year: number; asOf: string; usdReturn: number; btcGap: number; points: { at: string; value: number }[]; alt: string }
export function portfolioSeoModel(data: PublicPortfolio, now = new Date()): PortfolioSeoModel {
  const selected = periodPoints(data, "YTD", "", "");
  if (!selected.length) throw new Error("No public portfolio valuations available.");
  const first = selected[0], last = selected.at(-1)!;
  const usdReturn = (last.portfolioIndex / first.portfolioIndex - 1) * 100;
  const btcReturn = (last.btcIndex / first.btcIndex - 1) * 100;
  const year = new Date(data.asOf).getUTCFullYear(), imageDay = now.toISOString().slice(0, 10);
  const payload = { imageDay, year, asOf: data.asOf, usdReturn, btcGap: usdReturn - btcReturn, points: selected.map(p => ({ at: p.at, value: (p.portfolioIndex / first.portfolioIndex - 1) * 100 })) };
  const key = `p${PORTFOLIO_IMAGE_VERSION}-` + createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const valued = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(data.asOf));
  return { ...payload, key, alt: `${PORTFOLIO_NAME}, ${year} year to date: USD return ${pct(payload.usdReturn)}, return vs BTC ${pct(payload.btcGap)}. Valued ${valued} UTC.` };
}
export function portfolioImagePath(key: string) { return `/api/btc-portfolio/images/${key}.png`; }
export function parsePortfolioImageKey(path: string) { const key = path.replace(/\.png$/, ""); return /^p1-[a-f0-9]{64}$/.test(key) ? key : null; }
