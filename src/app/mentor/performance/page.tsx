import PerformanceDashboard from "@/Components/performance/PerformanceDashboard";
import JournalUpdatesPrompt from "@/Components/performance/JournalUpdatesPrompt";

export const metadata = {
  title: "Performance Journal | Thomas Johnston",
  description: "A public record of completed private leverage and prop trades, measured in R and published after positions close.",
};

export default function PerformancePage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] pb-24">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 pb-9 pt-9 sm:px-6 sm:pb-11 sm:pt-12">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)] lg:items-end lg:gap-12">
            <div className="max-w-2xl">
              <span className="rounded-full border border-[#ff6719]/20 bg-[#ff6719]/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff8b52]">
                Preview data
              </span>
              <h1 className="mt-4 break-words text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
                Performance Journal
              </h1>
              <p className="mt-3 break-words text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
                A public record of my private leverage and prop-trading strategies.
              </p>
            </div>
            <div className="lg:pb-0.5">
              <p className="max-w-xl break-words text-sm leading-6 text-zinc-400">
                Completed trades are published in R after they close. No active positions, signals, strategy rules, position sizing or dollar returns are shown.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3">
            {[
              ["Account", "Simulated prop trading"],
              ["Publication", "Closed trades only"],
              ["Schedule", "Updated daily"],
            ].map(([label, value]) => (
              <div key={label} className="bg-black/80 px-4 py-3.5 sm:px-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.17em] text-zinc-600">{label}</p>
                <p className="mt-1.5 break-words text-sm leading-5 text-zinc-300">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-600">
            Recorded in a simulated trading environment connected to prop accounts. Past results do not promise future performance.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
        <PerformanceDashboard />
      </section>
      <JournalUpdatesPrompt />
    </main>
  );
}
