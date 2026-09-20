import PerformanceDashboard from "@/Components/performance/PerformanceDashboard";
import { getLivePerformanceDataset } from "@/lib/performance/data";

export const metadata = {
  title: "Performance Journal | Thomas Johnston",
  description: "A public record of completed private leverage and prop trades, measured in R and published after positions close.",
};

const updatedFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Etc/UTC",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const dataset = await getLivePerformanceDataset();
  const tradeLabel = `${dataset.trades.length} closed trade${dataset.trades.length === 1 ? "" : "s"}`;

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-12 sm:pb-16">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 sm:pb-7 sm:pt-10">
          <h1 className="break-words text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
            Performance Journal
          </h1>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            <p className="break-words text-base leading-6 text-zinc-300 sm:text-lg">
              Closed prop-trading results, measured in R.
            </p>
            <p className="text-xs leading-5 text-zinc-500">
              {tradeLabel} · Updated {updatedFormatter.format(new Date(dataset.asOf))} GMT
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-6">
        <PerformanceDashboard dataset={dataset} />
      </section>

      <section className="mx-auto mt-8 max-w-7xl px-4 sm:mt-10 sm:px-6">
        <div className="border-t border-white/[0.07] pt-6 sm:flex sm:items-start sm:justify-between sm:gap-10">
          <div>
            <h2 className="text-sm font-medium text-zinc-300">About this record</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-600 sm:text-sm sm:leading-6">
              This journal publishes completed trades from my private leverage and prop-trading strategies. It excludes active positions, signals, strategy rules, position sizing and dollar returns.
            </p>
          </div>
          <p className="mt-3 max-w-md text-xs leading-5 text-zinc-600 sm:mt-0 sm:text-right">
            Recorded in a simulated trading environment connected to prop accounts. Past results do not promise future performance.
          </p>
        </div>
      </section>
    </main>
  );
}
