import Link from "next/link";
import { FaPlay } from "react-icons/fa";

// Centered "sign up to access" prompt shown to signed-out visitors on gated
// pages. Renders only non-sensitive marketing copy — no course content.
export default function AccessGate() {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-none" />
      <div className="relative flex flex-col items-center justify-center text-center min-h-[calc(100vh-4rem)] px-4">
        <p className="text-[var(--bp-accent)] uppercase tracking-widest text-sm mb-3">
          The Blueprint · Season 1
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold max-w-xl leading-tight">
          Sign up free to unlock the full course
        </h1>
        <p className="text-[var(--bp-text-dim)] mt-4 max-w-md">
          13 episodes on trading psychology, technicals and the TJSS Method —
          completely free. Create an account to start watching and track your
          progress.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-md bg-white text-black font-medium px-6 py-3 hover:bg-zinc-200 transition-colors"
          >
            <FaPlay className="text-sm" /> Sign up for free
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md border border-[var(--bp-border-strong)] px-6 py-3 hover:bg-white/5 transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
