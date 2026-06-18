import Link from "next/link";
import { FaTrophy, FaArrowRight } from "react-icons/fa";

// Season-level progress panel for the gated show page.
export default function ProgressOverview({
  total,
  completed,
  percent,
  isComplete,
}: {
  total: number;
  completed: number;
  percent: number;
  isComplete: boolean;
}) {
  if (total === 0) return null;

  return (
    <div className="bp-surface rounded-xl p-5 sm:p-6 max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--bp-text-dim)]">Your progress</p>
          <p className="text-lg font-semibold">
            {completed} of {total} complete
          </p>
        </div>
        <span className="text-2xl font-semibold text-[var(--bp-accent)]">
          {percent}%
        </span>
      </div>

      <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-[var(--bp-accent)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {isComplete ? (
        <Link
          href="/blueprint/certificate"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--bp-accent)] text-black font-semibold px-5 py-2.5 hover:brightness-110 transition-all"
        >
          <FaTrophy className="text-sm" /> View your certificate
        </Link>
      ) : (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--bp-text-dim)]">
          Finish all {total} episodes to earn your certificate
          <FaArrowRight className="text-xs" />
        </p>
      )}
    </div>
  );
}
