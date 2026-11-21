import type { Metadata } from "next";
import { PORTFOLIO_CANONICAL, portfolioImagePath, type PortfolioSeoModel } from "./seo-model";
import { portfolioHeadCopy } from "./head-copy";

export function portfolioMetadata(model: PortfolioSeoModel | null, origin: string, indexable: boolean, imageModel = model): Metadata {
  const images = imageModel ? [{ url: new URL(portfolioImagePath(imageModel.key), origin).href, width: 1200, height: 630, type: "image/png", alt: imageModel.alt }] : [];
  const { title, description } = portfolioHeadCopy(model);
  return {
    title: { absolute: title }, description,
    alternates: { canonical: PORTFOLIO_CANONICAL },
    robots: { index: indexable && !!model, follow: indexable && !!model, ...(indexable && model ? { googleBot: { index: true, follow: true, "max-image-preview": "large" as const } } : {}) },
    openGraph: { type: "website", url: PORTFOLIO_CANONICAL, siteName: "Chronicles", title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
