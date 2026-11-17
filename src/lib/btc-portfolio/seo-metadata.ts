import type { Metadata } from "next";
import { PORTFOLIO_CANONICAL, PORTFOLIO_DESCRIPTION, PORTFOLIO_TITLE, portfolioImagePath, type PortfolioSeoModel } from "./seo-model";

export function portfolioMetadata(model: PortfolioSeoModel | null, origin: string, indexable: boolean): Metadata {
  const images = model ? [{ url: new URL(portfolioImagePath(model.key), origin).href, width: 1200, height: 630, type: "image/png", alt: model.alt }] : [];
  return {
    title: { absolute: PORTFOLIO_TITLE }, description: PORTFOLIO_DESCRIPTION,
    alternates: { canonical: PORTFOLIO_CANONICAL },
    robots: { index: indexable && !!model, follow: indexable && !!model, ...(indexable && model ? { googleBot: { index: true, follow: true, "max-image-preview": "large" as const } } : {}) },
    openGraph: { type: "website", url: PORTFOLIO_CANONICAL, siteName: "Thomas Johnston", title: PORTFOLIO_TITLE, description: PORTFOLIO_DESCRIPTION, images },
    twitter: { card: "summary_large_image", title: PORTFOLIO_TITLE, description: PORTFOLIO_DESCRIPTION, images },
  };
}
