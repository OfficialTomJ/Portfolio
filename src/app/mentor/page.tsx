import Link from "next/link";
import { FaPlay, FaLock, FaCheck } from "react-icons/fa";
import { getSession } from "../../lib/session";

// Marketing-only curriculum teaser (module names, not gated video content).
const CURRICULUM = [
  { name: "Introduction", count: 2, blurb: "Get set up and meet your mentor." },
  {
    name: "Basics of Cryptocurrency",
    count: 3,
    blurb: "Blockchain, crypto fundamentals & the trader's mindset.",
  },
  {
    name: "Getting Started",
    count: 1,
    blurb: "Set up your platforms and charts like a pro.",
  },
  {
    name: "Technical Analysis",
    count: 2,
    blurb: "Read charts and the indicators that actually matter.",
  },
  {
    name: "The TJSS Method",
    count: 4,
    blurb: "The full spot-swing system: entries, risk and exits.",
  },
  { name: "Final", count: 1, blurb: "Where to go from here." },
];

// PUBLIC marketing landing. No course content is queried or exposed here.
export default async function MentorLanding() {
  const session = await getSession();
  const signedIn = !!session?.user;

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--bp-border)]">
        <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--bp-border-strong)] px-3 py-1 text-xs text-[var(--bp-text-dim)] mb-6">
            <span className="text-[var(--bp-accent)] font-semibold">FREE</span>
            · Season 1 · 13 episodes
          </span>
          <h1 className="text-5xl sm:text-7xl font-semibold max-w-3xl leading-[1.02]">
            The Blueprint<span className="text-[var(--bp-accent)]">.</span>
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-[var(--bp-text-dim)] max-w-2xl">
            Learn to trade like a professional — a proven system that simplifies
            markets and builds consistency. Watch the videos, follow the
            outlines, and track your progress.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {signedIn ? (
              <Link
                href="/blueprint"
                className="inline-flex items-center gap-2 rounded-md bg-white text-black font-medium px-6 py-3 hover:bg-zinc-200 transition-colors"
              >
                <FaPlay className="text-sm" /> Go to your course
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--bp-accent)] text-black font-semibold px-7 py-3 hover:brightness-110 transition-all"
                >
                  <FaPlay className="text-sm" /> Sign up free to watch
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--bp-border-strong)] px-6 py-3 hover:bg-white/5 transition-colors"
                >
                  Log in
                </Link>
              </>
            )}
          </div>

          {!signedIn && (
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--bp-text-dim)]">
              <span className="inline-flex items-center gap-2">
                <FaCheck className="text-[var(--bp-accent)] text-xs" /> 100% free
              </span>
              <span className="inline-flex items-center gap-2">
                <FaCheck className="text-[var(--bp-accent)] text-xs" /> No card
                required
              </span>
              <span className="inline-flex items-center gap-2">
                <FaCheck className="text-[var(--bp-accent)] text-xs" /> Progress
                saved to your account
              </span>
            </div>
          )}
        </div>
      </section>

      {/* What's inside */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <h2 className="text-sm uppercase tracking-widest text-[var(--bp-text-dim)] mb-2">
          What&apos;s inside
        </h2>
        <p className="text-2xl font-semibold mb-8">Season 1 curriculum</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CURRICULUM.map((m, i) => (
            <div
              key={m.name}
              className="bp-surface rounded-xl p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--bp-accent)] text-sm font-semibold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-xs text-[var(--bp-text-dim)]">
                  {m.count} {m.count === 1 ? "episode" : "episodes"}
                </span>
              </div>
              <h3 className="font-semibold">{m.name}</h3>
              <p className="text-sm text-[var(--bp-text-dim)] mt-1">{m.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Show tile / CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
        <Link href="/blueprint" className="group block">
          <div className="bp-surface rounded-xl overflow-hidden transition-all duration-300 group-hover:border-[var(--bp-border-strong)] sm:flex">
            <div className="relative aspect-video sm:w-1/2 bg-gradient-to-br from-[#ff6719]/20 via-black to-black flex items-center justify-center">
              <span className="text-3xl font-semibold tracking-tight">
                The Blueprint<span className="text-[var(--bp-accent)]">.</span>
              </span>
              {!signedIn && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-[var(--bp-text-dim)] bg-black/60 rounded px-2 py-1">
                  <FaLock className="text-[10px]" /> Members
                </div>
              )}
            </div>
            <div className="p-6 sm:p-8 sm:w-1/2 flex flex-col justify-center">
              <h3 className="text-2xl font-semibold">Season 1</h3>
              <p className="text-[var(--bp-text-dim)] mt-2">
                13 episodes covering psychology, technicals and the complete TJSS
                Method.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-[var(--bp-accent)] font-medium">
                {signedIn ? "Continue watching" : "Sign up free to start"}
                <FaPlay className="text-xs" />
              </span>
            </div>
          </div>
        </Link>
      </section>
    </main>
  );
}
