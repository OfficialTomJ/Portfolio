import Link from "next/link";
import { FaArrowRight, FaChartLine } from "react-icons/fa";
import { isDashboardNew } from "../lib/whats-new";

// Entry points to the TJSS dashboard, in the two shapes the Blueprint needs.
//
// `hero`  sits under ProgressOverview on /blueprint and matches that component's
//         shell, so the two read as a pair rather than a banner bolted on top.
// `row`   is appended to the horizontal "The TJSS Method" section row. It MUST
//         carry `bp-card` (mentor.css: scroll-snap-align + flex:0 0 auto) and
//         EpisodeCard's width, or it breaks the row's snap scrolling.
//
// The NEW pill is gated on isDashboardNew() rather than hardcoded, so every
// badge across the site expires on the same date without anyone maintaining it.

function NewPill() {
  return (
    <span className="rounded-full bg-[var(--bp-accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
      New
    </span>
  );
}

export default function DashboardCard({
  variant,
  note,
}: {
  variant: "hero" | "row";
  /** Replaces the default description where the surrounding page gives the
   *  card a more specific meaning, e.g. on the lesson that teaches the method. */
  note?: string;
}) {
  const isNew = isDashboardNew();

  if (variant === "row") {
    return (
      <Link href="/dashboard" className="bp-card group block w-[260px] sm:w-[300px]">
        <div className="relative aspect-video overflow-hidden rounded-lg bp-surface transition-all duration-300 group-hover:scale-[1.04] group-hover:border-[var(--bp-border-strong)]">
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ff6719]/25 via-black to-black">
            <FaChartLine className="text-3xl text-[var(--bp-accent)]" />
          </div>
          {isNew && (
            <div className="absolute left-2 top-2">
              <NewPill />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black">
              <FaArrowRight />
            </div>
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xs text-[var(--bp-text-dim)]">Members&apos; tool</p>
          <p className="text-sm font-medium leading-snug">TJSS Dashboard</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard"
      className="group block rounded-xl bp-surface p-5 transition-colors hover:border-[var(--bp-border-strong)] sm:p-6"
    >
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--bp-accent)]/15 text-[var(--bp-accent)]">
          <FaChartLine />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isNew && <NewPill />}
            <p className="font-semibold">TJSS Dashboard</p>
          </div>
          <p className="mt-1 text-sm text-[var(--bp-text-dim)]">
            {note ??
              "The method's rules applied to live Bitcoin price and the Fear & Greed Index, with a historical simulation."}
          </p>
        </div>
        <FaArrowRight className="ml-auto hidden shrink-0 text-[var(--bp-text-dim)] transition-transform group-hover:translate-x-1 sm:block" />
      </div>
    </Link>
  );
}
