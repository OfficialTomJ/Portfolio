import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { portfolioPublicEnabled } from "@/lib/btc-portfolio/mode";
import { loadDatabasePortfolio } from "@/lib/btc-portfolio/public-repository";
import { portfolioSeoModel } from "@/lib/btc-portfolio/seo-model";
import { portfolioMetadata } from "@/lib/btc-portfolio/seo-metadata";
import { ensurePortfolioSocialImage } from "@/lib/btc-portfolio/seo-images";
import { siteOrigin } from "@/lib/site-origin";
import PortfolioAutoRefresh from "@/Components/btc-portfolio/PortfolioAutoRefresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const getPortfolio = cache(async () => portfolioPublicEnabled() ? loadDatabasePortfolio().catch(() => null) : null);
export async function generateMetadata(): Promise<Metadata> {
  const data = await getPortfolio();
  const model = data ? portfolioSeoModel(data) : null;
  if (model) { try { await ensurePortfolioSocialImage(model); } catch { /* The versioned image route can retry without taking down the visitor page. */ } }
  return portfolioMetadata(model, siteOrigin(), process.env.VERCEL_ENV === "production" && portfolioPublicEnabled());
}
export default async function PortfolioPage() {
  if (!portfolioPublicEnabled()) notFound();
  const data = await getPortfolio();
  return <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-medium tracking-tight text-zinc-200">Public Portfolio<span className="text-[#ff8b52]">.</span></h1>{process.env.VERCEL_ENV !== "production" && <span className="rounded-full border border-amber-200/15 bg-amber-200/[.03] px-3 py-1.5 text-[9px] uppercase tracking-[.12em] text-amber-200/70">Staging preview</span>}</header>
    {data ? <PortfolioAutoRefresh data={data}/> : <section className="rounded-xl border border-white/10 p-10 text-center"><h2 className="text-zinc-200">Portfolio unavailable</h2><p className="mt-3 text-sm text-zinc-500">Please try again shortly.</p></section>}
  </main>;
}
