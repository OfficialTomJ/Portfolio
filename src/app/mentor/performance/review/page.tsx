import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSyncControl from "@/Components/performance/AdminSyncControl";
import PrivatePerformanceDashboard from "@/Components/performance/PrivatePerformanceDashboard";
import PerformanceUnavailable from "@/Components/performance/PerformanceUnavailable";
import ReviewIdeasManager from "@/Components/performance/ReviewIdeasManager";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { getAdminPerformanceSnapshot } from "@/lib/performance/admin-data";
import { getIdeasSnapshot } from "@/lib/performance/ideas-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Performance review | Admin",
  robots: { index: false, follow: false },
};

export default async function PerformanceReviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!await getPerformanceAdminSession()) notFound();
  const showIdeas = (await searchParams).view === "ideas";
  const [snapshot, ideas] = await Promise.all([
    getAdminPerformanceSnapshot().catch(error => {
      console.error("[performance/review] failed to load private review", error);
      return null;
    }),
    getIdeasSnapshot().catch(() => {
      console.error("[performance/review] failed to load trade ideas");
      return null;
    }),
  ]);

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-12 sm:pb-16">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-6 pt-8 sm:px-6 sm:pt-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#ff8b52]">Admin review</p>
            <h1 className="mt-2 break-words text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">Performance Journal</h1>
            <Link href="/performance" className="mt-2 inline-block text-xs text-zinc-500 underline-offset-4 hover:text-white hover:underline">View public journal</Link>
          </div>
          {snapshot && <AdminSyncControl lastSyncAt={snapshot.lastSyncAt} />}
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 pt-5 sm:px-6 sm:pt-6">
        <nav aria-label="Journal review views" className="flex flex-wrap gap-2">
          {[{ href: "/performance/review", label: "Trades & performance", active: !showIdeas }, { href: "/performance/review?view=ideas", label: "Trade ideas", active: showIdeas }].map(item => (
            <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm ${item.active ? "border-[#ff6719]/40 bg-[#ff6719]/10 text-[#ffad83]" : "border-white/10 text-zinc-400 hover:text-white"}`}>{item.label}</Link>
          ))}
        </nav>
        {showIdeas ? (
          <section aria-labelledby="trade-ideas-title" className="space-y-5">
            <div><h2 id="trade-ideas-title" className="text-2xl font-semibold">Trade ideas</h2><p className="mt-2 text-sm text-zinc-400">Create ideas and categorise your trade attempts as part of your journal review.</p></div>
            {ideas ? <ReviewIdeasManager initial={ideas} /> : <PerformanceUnavailable title="Trade ideas are temporarily unavailable." />}
          </section>
        ) : snapshot ? (
          <PrivatePerformanceDashboard dataset={snapshot.dataset} pendingReviews={snapshot.pendingReviews} annotations={snapshot.annotations} activePositions={snapshot.activePositions} reconciliation={snapshot.reconciliation} tags={snapshot.tags} ideaGroups={ideas ? { ideas: ideas.ideas, assignments: ideas.assignments } : null} />
        ) : (
          <PerformanceUnavailable title="Private review is temporarily unavailable." />
        )}
      </div>
    </main>
  );
}
