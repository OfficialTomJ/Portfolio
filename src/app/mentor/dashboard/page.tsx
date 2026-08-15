import { getMemberSession } from "../../../lib/session";
import AccessGate from "../../../Components/AccessGate";
import TjssDashboard from "../../../Components/tjss/TjssDashboard";

// GATED TJSS dashboard, the same member gate as the Blueprint course this
// ships inside. Signals and backtests are computed server-side and fetched from
// /api/tjss/* (also gated); no strategy parameter reaches the browser.
export const metadata = {
  title: "TJSS Dashboard, The Blueprint",
  description:
    "Live Bitcoin Fear & Greed signals and backtesting for the TJSS Method.",
};

export default async function DashboardPage() {
  if (!(await getMemberSession())) return <AccessGate />;

  return (
    <main className="pb-24">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-8">
          <p className="text-[var(--bp-accent)] text-sm font-medium uppercase tracking-widest mb-3">
            TJSS Method
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold">
            Fear &amp; Greed Dashboard<span className="text-[var(--bp-accent)]">.</span>
          </h1>
          <p className="mt-3 text-[var(--bp-text-dim)] max-w-2xl">
            Published research: the TJSS ruleset applied to Bitcoin price and the
            Crypto Fear &amp; Greed Index, with a historical simulation you can
            run over any period.
          </p>

          {/* Persistent and non-dismissable. The disclosure modal is accepted
              once and forgotten; the framing of this page has to travel with
              the page itself, above the data rather than beneath it. */}
          <p className="mt-6 max-w-2xl rounded-lg border border-[var(--bp-border)] bg-black/20 px-4 py-3 text-xs leading-relaxed text-[var(--bp-text-dim)]">
            <strong className="text-[var(--bp-text)]">
              This is research, not advice.
            </strong>{" "}
            Everything below describes what a documented set of rules did when
            applied to public data. Nothing here is a recommendation, a signal to
            trade, or advice about what you should do. It takes no account of
            your objectives, financial situation or needs.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <TjssDashboard />
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-10">
        <p className="text-xs text-[var(--bp-text-dim)] leading-relaxed border-t border-[var(--bp-border)] pt-6">
          <strong className="text-[var(--bp-text)]">Not financial advice.</strong>{" "}
          The TJSS Method and this dashboard are educational and research tools.
          Rule states are derived from the Crypto Fear &amp; Greed Index
          (alternative.me) and historical BTC price data, and can be wrong.
          Simulated results are hypothetical, carry the benefit of hindsight, and
          are not a reliable indicator of future results. Markets are risky; do
          your own research, obtain licensed advice, and never invest more than
          you can afford to lose. See{" "}
          <a href="/compliance" className="underline hover:text-[var(--bp-text)]">
            Compliance &amp; Disclosure
          </a>
          .
        </p>
      </section>
    </main>
  );
}
