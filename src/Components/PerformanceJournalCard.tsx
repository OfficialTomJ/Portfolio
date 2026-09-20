import Link from "next/link";
import { FaArrowRight, FaBookOpen } from "react-icons/fa";

export default function PerformanceJournalCard({
  variant,
}: {
  variant: "landing" | "row";
}) {
  if (variant === "row") {
    return (
      <Link href="/performance" className="bp-card group block w-[260px] sm:w-[300px]">
        <div className="relative aspect-video overflow-hidden rounded-lg bp-surface transition-all duration-300 group-hover:scale-[1.04] group-hover:border-[var(--bp-border-strong)]">
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ff6719]/20 via-black to-black">
            <span className="grid h-14 w-14 place-items-center rounded-xl border border-[#ff6719]/20 bg-[#ff6719]/10 text-[var(--bp-accent)]">
              <FaBookOpen className="text-2xl" />
            </span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black">
              <FaArrowRight />
            </div>
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xs text-[var(--bp-text-dim)]">Public journal</p>
          <p className="text-sm font-medium leading-snug">Performance Journal</p>
          <p className="mt-1 text-xs leading-5 text-[var(--bp-text-dim)]">
            Closed private prop-trading results in R, separate from the TJSS Method.
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/performance"
      className="group block rounded-xl bp-surface p-6 transition-colors hover:border-[var(--bp-border-strong)] sm:p-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--bp-accent)]/15 text-[var(--bp-accent)]">
          <FaBookOpen className="text-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--bp-accent)]">
            Public performance journal
          </p>
          <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
            Trading results, recorded in public.
          </h2>
          <p className="mt-2 max-w-3xl leading-7 text-[var(--bp-text-dim)]">
            A record of my closed private leverage and prop trades, measured in R. Separate from the TJSS Method, with no active positions or position sizing shown.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 font-medium text-[var(--bp-accent)] sm:ml-auto">
          View performance journal
          <FaArrowRight className="text-xs transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
