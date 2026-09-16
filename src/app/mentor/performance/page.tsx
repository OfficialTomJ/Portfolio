import Link from "next/link";
import { FaArrowRightLong } from "react-icons/fa6";
import PerformanceDashboard from "@/Components/performance/PerformanceDashboard";

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
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                Performance Journal
              </h1>
              <p className="mt-3 text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
                A public record of my private leverage and prop-trading strategies, separate from the TJSS Method.
              </p>
            </div>
            <div className="lg:pb-0.5">
              <p className="max-w-xl text-sm leading-6 text-zinc-400">
                Completed trades are published in R after they close. No active positions, signals, strategy rules, position sizing or dollar returns are shown.
              </p>
              <a
                href="#journal-updates"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#ff6719]/35 bg-[#ff6719]/[0.09] px-4 text-sm font-medium text-[#ff9a67] transition-colors hover:border-[#ff6719]/60 hover:bg-[#ff6719]/[0.14] hover:text-white"
              >
                Get journal updates <FaArrowRightLong className="text-xs" />
              </a>
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
                <p className="mt-1.5 text-sm text-zinc-300">{value}</p>
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

        <section
          id="journal-updates"
          className="relative mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-[#ff6719]/20 bg-[#07090d] p-5 sm:mt-8 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(255,103,25,0.13),transparent_42%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8b52]">Journal updates</p>
              <h2 className="mt-3 text-2xl font-medium tracking-[-0.025em] text-white">Follow the journal</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Get notified when new closed trades and performance updates are published. Subscribe for journal updates or join the community for broader market discussion.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/substack"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--bp-accent)] px-5 text-sm font-semibold text-black transition-all hover:brightness-110"
              >
                Subscribe on Substack <FaArrowRightLong className="text-xs" />
              </Link>
              <a
                href="https://discord.gg/8tK967YJ6y"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.035] px-5 text-sm font-medium text-zinc-200 transition-colors hover:border-white/[0.22] hover:bg-white/[0.07] hover:text-white"
              >
                Join the Discord
              </a>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
