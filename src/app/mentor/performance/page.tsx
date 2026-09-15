import { getMemberSession } from "@/lib/session";
import AccessGate from "@/Components/AccessGate";
import PerformanceDashboard from "@/Components/performance/PerformanceDashboard";

export const metadata = {
  title: "Performance Journal, The Blueprint",
  description: "A retrospective journal of closed trades and risk-normalised performance.",
};

export default async function PerformancePage() {
  if (!(await getMemberSession())) return <AccessGate />;

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-24">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_80%_at_55%_-20%,rgba(59,130,246,0.13),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-9 pt-11 sm:px-6 sm:pb-11 sm:pt-14">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue-400/20 bg-blue-400/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300">
              UI preview
            </span>
            <span className="text-xs text-zinc-600">Mock performance data</span>
          </div>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--bp-accent)]">Performance journal</p>
              <h1 className="mt-2 max-w-3xl text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
                Every closed trade.<br className="hidden sm:block" /> Measured in risk.
              </h1>
            </div>
            <p className="max-w-md text-sm leading-6 text-zinc-400">
              A complete retrospective record of closed positions. No live positions, account balances, position sizes or monetary returns are shown.
            </p>
          </div>
          <div className="mt-7 flex items-center gap-3 border-l-2 border-blue-400/50 pl-3 text-xs leading-5 text-zinc-500">
            Published only after a position is fully closed. Historical performance is not a reliable indicator of future results.
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
        <PerformanceDashboard />
      </section>
    </main>
  );
}
