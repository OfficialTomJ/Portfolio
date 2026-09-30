import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSyncControl from "@/Components/performance/AdminSyncControl";
import PerformanceDashboard from "@/Components/performance/PerformanceDashboard";
import PerformanceUnavailable from "@/Components/performance/PerformanceUnavailable";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { getAdminPerformanceSnapshot } from "@/lib/performance/admin-data";
import type { AdminActivePosition } from "@/lib/performance/admin-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Performance review | Admin",
  robots: { index: false, follow: false },
};

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function ActivePositions({ positions }: { positions: AdminActivePosition[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07090d]">
      <div className="border-b border-white/[0.08] px-4 py-4 sm:px-5">
        <h2 className="text-base font-medium text-zinc-100">Active positions</h2>
        <p className="mt-1 text-xs text-zinc-500">Confirmed in the latest sync. Not included in R results.</p>
      </div>
      {positions.length === 0 ? (
        <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">No active positions at the last sync.</p>
      ) : (
        <div className="grid gap-px bg-white/[0.07] md:grid-cols-2">
          {positions.map((position) => (
            <div key={`${position.symbol}:${position.direction}:${position.openedAt}`} className="min-w-0 bg-[#07090d] px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words font-medium text-zinc-100">{position.symbol.replace("USDT", " / USDT")}</p>
                <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${position.direction === "Long" ? "border-[#22c55e]/35 bg-[#22c55e]/[0.10] text-[#22c55e]" : "border-[#ef4444]/35 bg-[#ef4444]/[0.10] text-[#ef4444]"}`}>
                  {position.direction}
                </span>
              </div>
              <p className="mt-2 break-words text-xs leading-5 text-zinc-500">
                Opened {timeFormat.format(new Date(position.openedAt))} GMT · Entry {position.entryPrice.toLocaleString("en-AU", { maximumFractionDigits: 6 })}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

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
            <p className="mt-2 text-sm text-zinc-400">Published and pending-review closed trades.</p>
            <Link href="/performance" className="mt-2 inline-block text-xs text-zinc-500 underline-offset-4 hover:text-white hover:underline">View public journal</Link>
          </div>
          {snapshot && <AdminSyncControl lastSyncAt={snapshot.lastSyncAt} />}
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 pt-5 sm:px-6 sm:pt-6">
        {snapshot ? (
          <>
            <div className="rounded-xl border border-[#ff6719]/20 bg-[#ff6719]/[0.05] px-4 py-3 text-xs leading-5 text-[#ffb38d]">
              Private view · {snapshot.pendingTradeIds.length} result{snapshot.pendingTradeIds.length === 1 ? "" : "s"} pending review. Viewing and syncing do not grant publication approval.
            </div>
            <ActivePositions positions={snapshot.activePositions} />
            <PerformanceDashboard dataset={snapshot.dataset} reviewMode pendingTradeIds={snapshot.pendingTradeIds} />
          </>
        ) : (
          <PerformanceUnavailable title="Private review is temporarily unavailable." />
        )}
      </div>
    </main>
  );
}
