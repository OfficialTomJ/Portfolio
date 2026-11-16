import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { portfolioDatabaseEnabled } from "@/lib/btc-portfolio/mode";
import { loadDatabasePortfolio } from "@/lib/btc-portfolio/workspace-repository";
import PortfolioAutoRefresh from "@/Components/btc-portfolio/PortfolioAutoRefresh";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Public Portfolio | Thomas Johnston", description: "Public portfolio performance against Bitcoin, with combined asset and cash allocation.", robots: { index: false, follow: false } };
export default async function SpotPortfolioPage() {
  if (!portfolioDatabaseEnabled()) notFound();
  if (portfolioDatabaseEnabled()) {
    const data = await loadDatabasePortfolio().catch(() => null);
    return <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6"><header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-medium tracking-tight text-zinc-200">Public Portfolio<span className="text-[#ff8b52]">.</span></h1><span className="rounded-full border border-amber-200/15 bg-amber-200/[.03] px-3 py-1.5 text-[9px] uppercase tracking-[.12em] text-amber-200/70">Staging preview</span></header>{data ? <PortfolioAutoRefresh data={data}/> : <section className="rounded-xl border border-white/10 p-10 text-center"><h2 className="text-zinc-200">Portfolio unavailable</h2><p className="mt-3 text-sm text-zinc-500">Portfolio storage is unavailable. Please retry after the connection is restored.</p></section>}</main>;
  }
  notFound();
}
