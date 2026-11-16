import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { portfolioDatabaseEnabled } from "@/lib/btc-portfolio/mode";
import { loadPortfolioWorkspace } from "@/lib/btc-portfolio/workspace-repository";
import PortfolioWorkspaceAdmin from "@/Components/btc-portfolio/PortfolioWorkspaceAdmin";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Public Portfolio | Admin", robots: { index: false, follow: false } };
export default async function SpotPortfolioAdminPage() {
  if (!portfolioDatabaseEnabled() || !await getPerformanceAdminSession()) notFound();
  if (portfolioDatabaseEnabled()) {
    const snapshot = await loadPortfolioWorkspace().catch(() => null);
    return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6"><header><Link href="/admin" className="text-xs text-zinc-500">← Creator dashboard</Link><h1 className="mt-5 text-3xl font-medium text-zinc-100">Public Portfolio · Admin</h1><p className="mt-3 text-xs leading-6 text-zinc-400">Private database workspace. Save a draft, validate it, then review and publish a staging release. The visitor page remains read only.</p></header>{snapshot ? <PortfolioWorkspaceAdmin initial={snapshot}/> : <p className="rounded-xl border border-white/10 p-6 text-sm text-zinc-400">Portfolio workspace unavailable. No data has changed.</p>}</main>;
  }
  notFound();
}
