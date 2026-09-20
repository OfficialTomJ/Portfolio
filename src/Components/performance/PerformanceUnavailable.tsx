export default function PerformanceUnavailable({
  title = "Results are temporarily unavailable.",
}: {
  title?: string;
}) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-[#ff6719]/20 bg-[#ff6719]/[0.045] px-5 py-8 sm:px-8 sm:py-10"
    >
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff8b52]">
          Journal unavailable
        </p>
        <h2 className="mt-3 text-xl font-medium text-white sm:text-2xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          The journal connection could not be verified, so no performance figures are being shown. This avoids presenting incomplete or misleading results.
        </p>
        <p className="mt-2 text-sm text-zinc-400">Please check again shortly.</p>
      </div>
    </section>
  );
}
