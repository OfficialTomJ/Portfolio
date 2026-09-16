import { getMemberSession } from "@/lib/session";
import AccessGate from "@/Components/AccessGate";
import PerformanceDashboard from "@/Components/performance/PerformanceDashboard";

export const metadata = {
  title: "Performance Journal, The Blueprint",
  description: "A transparent journal of closed prop trades and risk-normalised performance.",
};

export default async function PerformancePage() {
  // Mock-data branch previews are intentionally reviewable without an account.
  // Production always uses the normal verified-member gate.
  const isPreview = process.env.VERCEL_ENV === "preview";
  if (!isPreview && !(await getMemberSession())) return <AccessGate />;

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-24">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-12">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="rounded-full border border-[#ff6719]/20 bg-[#ff6719]/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff8b52]">
                Mock data
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                Performance Journal
              </h1>
              <p className="mt-2 text-sm text-zinc-400">Closed trades measured in R.</p>
            </div>
            <p className="max-w-md text-xs leading-5 text-zinc-500 lg:text-right">
              I created this journal to share my actual prop trading returns in R. It records closed trades only, never active positions. Past results do not guarantee future returns.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
        <PerformanceDashboard />
      </section>
    </main>
  );
}
