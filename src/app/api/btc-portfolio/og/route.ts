import { portfolioPublicEnabled } from "@/lib/btc-portfolio/mode";
import { loadDatabasePortfolio } from "@/lib/btc-portfolio/public-repository";
import { portfolioSeoModel } from "@/lib/btc-portfolio/seo-model";
import { ensurePortfolioSocialImage, portfolioImageResponse } from "@/lib/btc-portfolio/seo-images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Daily cron and the stable latest-image URL share the current prod/dev DB boundary. */
export async function GET() {
  if (!portfolioPublicEnabled()) return new Response("Not found", { status: 404 });
  try { return portfolioImageResponse(await ensurePortfolioSocialImage(portfolioSeoModel(await loadDatabasePortfolio())), false); }
  catch { return new Response("Portfolio image unavailable", { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
