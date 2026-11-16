import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { btcMockEnabled, portfolioDatabaseEnabled } from "@/lib/btc-portfolio/mode";
import { loadPortfolioWorkspace } from "@/lib/btc-portfolio/workspace-repository";
import PortfolioWorkspaceAdmin from "@/Components/btc-portfolio/PortfolioWorkspaceAdmin";
import { loadBtcAdmin } from "@/lib/btc-portfolio/repository";
import PortfolioAdmin from "@/Components/btc-portfolio/PortfolioAdmin";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "BTC Portfolio | Admin", robots: { index: false, follow: false } };
export default async function SpotPortfolioAdminPage() {
  if (!btcMockEnabled() || !await getPerformanceAdminSession()) notFound();
  if (portfolioDatabaseEnabled()) {
    const snapshot = await loadPortfolioWorkspace().catch(() => null);
    return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6"><header><Link href="/admin" className="text-xs text-zinc-500">← Creator dashboard</Link><h1 className="mt-5 text-3xl font-medium text-zinc-100">Public Portfolio · Admin</h1><p className="mt-3 text-xs leading-6 text-zinc-400">Private database workspace. Save a draft, validate it, then review and publish a staging release. The visitor page remains read only.</p></header>{snapshot ? <PortfolioWorkspaceAdmin initial={snapshot}/> : <p className="rounded-xl border border-white/10 p-6 text-sm text-zinc-400">Portfolio workspace unavailable. No data has changed.</p>}</main>;
  }
  if (btcMockEnabled()) {
    const data = await loadBtcAdmin().catch(() => null);
    return <main className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6"><header><Link href="/admin" className="text-xs text-zinc-500">← Creator dashboard</Link><div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.16em] text-[#ff8b52]">Private creator workspace</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-zinc-100">BTC Portfolio</h1></div><Link href="/portfolio" className="min-h-11 rounded-lg border border-white/10 px-4 py-3 text-xs text-zinc-400">View public page ↗</Link></div><Link href="/admin/portfolio/backfill" className="mt-4 inline-block text-xs text-[#ffad83]">Review estimated YTD backfill →</Link><p className="mt-2 text-[11px] text-zinc-500">The editor below remains the isolated fictional workspace. The owner-reported reconstruction is reviewed separately.</p></header>{data ? <PortfolioAdmin initial={data}/> : <section className="rounded-xl border border-white/10 p-8 text-sm text-zinc-400">Mock storage is unavailable. Check the database connection and reload. No data has changed.</section>}</main>;
  }
  notFound();
}
