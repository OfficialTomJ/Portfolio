import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSyncControl from "@/Components/performance/AdminSyncControl";
import PerformanceDashboard from "@/Components/performance/PerformanceDashboard";
import PerformanceUnavailable from "@/Components/performance/PerformanceUnavailable";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { getAdminPerformanceSnapshot } from "@/lib/performance/admin-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Performance review | Admin",
  robots: { index: false, follow: false },
};

export default async function PerformanceReviewPage() {
  if (!await getPerformanceAdminSession()) notFound();

  let snapshot;
  try {
    snapshot = await getAdminPerformanceSnapshot();
  } catch (error) {
    console.error("[performance/review] failed to load private review", error);
    snapshot = null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-12 sm:pb-16">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-6 pt-8 sm:px-6 sm:pt-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#ff8b52]">Admin review</p>
            <h1 className="mt-2 break-words text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">Performance Journal</h1>
            <p className="mt-2 text-sm text-zinc-400">Manage trades and review your performance.</p>
            <Link href="/performance" className="mt-2 inline-block text-xs text-zinc-500 underline-offset-4 hover:text-white hover:underline">View public journal</Link>
          </div>
          {snapshot && <AdminSyncControl lastSyncAt={snapshot.lastSyncAt} />}
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 pt-5 sm:px-6 sm:pt-6">
        {snapshot ? (
          <>
            <div className="rounded-xl border border-[#ff6719]/20 bg-[#ff6719]/[0.05] px-4 py-3 text-xs leading-5 text-[#ffb38d]">
              Private view · {snapshot.pendingReviews.length} result{snapshot.pendingReviews.length === 1 ? "" : "s"} pending review. Only the checkmark beside a closed trade approves it for publication.
            </div>
            <PerformanceDashboard dataset={snapshot.dataset} reviewMode pendingReviews={snapshot.pendingReviews} annotations={snapshot.annotations} activePositions={snapshot.activePositions} tagCatalogue={snapshot.tags} />
          </>
        ) : (
          <PerformanceUnavailable title="Private review is temporarily unavailable." />
        )}
      </div>
    </main>
  );
}
