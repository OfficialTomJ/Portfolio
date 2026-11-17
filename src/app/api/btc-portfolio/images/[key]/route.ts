import { portfolioPublicEnabled } from "@/lib/btc-portfolio/mode";
import { loadDatabasePortfolio } from "@/lib/btc-portfolio/public-repository";
import { parsePortfolioImageKey, portfolioSeoModel } from "@/lib/btc-portfolio/seo-model";
import { ensurePortfolioSocialImage, loadPortfolioSocialImage, portfolioImageResponse } from "@/lib/btc-portfolio/seo-images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const key = parsePortfolioImageKey((await params).key);
  if (!portfolioPublicEnabled() || !key) return new Response("Not found", { status: 404 });
  try {
    let image = await loadPortfolioSocialImage(key);
    if (!image) { const model = portfolioSeoModel(await loadDatabasePortfolio()); if (model.key !== key) return new Response("Not found", { status: 404 }); image = await ensurePortfolioSocialImage(model); }
    return portfolioImageResponse(image);
  } catch { return new Response("Portfolio image unavailable", { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
