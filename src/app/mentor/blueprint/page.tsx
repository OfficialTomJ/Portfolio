import { getSections } from "../../../lib/blueprint";
import { getSession } from "../../../lib/session";
import { getUserProgress } from "../../../lib/progress";
import EpisodeCard from "../../../Components/EpisodeCard";
import AccessGate from "../../../Components/AccessGate";
import ProgressOverview from "../../../Components/ProgressOverview";

// GATED show page. Content is only queried for verified, signed-in users.
export default async function BlueprintShow() {
  const session = await getSession();
  if (!session?.user?.emailVerified) return <AccessGate />;

  const [sections, progress] = await Promise.all([
    getSections(),
    getUserProgress(session.user.id),
  ]);

  // Continue watching: started-but-unfinished episodes (most recent first);
  // if none, surface the next uncompleted episode.
  const videos = sections.flatMap((s) => s.episodes).filter((e) => e.type === "video");
  const started = videos
    .filter((v) => {
      const p = progress[v.slug];
      return p && p.percent > 0 && !p.completed;
    })
    .sort(
      (a, b) =>
        (progress[b.slug].updatedAt?.getTime() ?? 0) -
        (progress[a.slug].updatedAt?.getTime() ?? 0)
    );
  let continueList = started;
  if (continueList.length === 0) {
    const next = videos.find((v) => !progress[v.slug]?.completed);
    continueList = next ? [next] : [];
  }

  // Season-level completion (video episodes only; resources are bonus).
  const total = videos.length;
  const completed = videos.filter((v) => progress[v.slug]?.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <main className="pb-24">
      {/* Show hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-10">
          <p className="text-[var(--bp-accent)] text-sm font-medium uppercase tracking-widest mb-3">
            Season 1
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold">
            The Blueprint<span className="text-[var(--bp-accent)]">.</span>
          </h1>
          <p className="mt-4 text-[var(--bp-text-dim)] max-w-2xl">
            A step-by-step framework for consistent trading — psychology, risk,
            technicals and the TJSS Method.
          </p>
          <div className="mt-8">
            <ProgressOverview
              total={total}
              completed={completed}
              percent={percent}
              isComplete={total > 0 && completed === total}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-10">
        {/* Continue watching */}
        {continueList.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Continue watching</h2>
            <div className="bp-row">
              {continueList.map((ep) => (
                <EpisodeCard key={ep.slug} episode={ep} progress={progress[ep.slug]} />
              ))}
            </div>
          </section>
        )}

        {/* Section rows */}
        {sections.length === 0 && (
          <p className="text-[var(--bp-text-dim)]">
            No episodes yet. Run <code>npm run seed</code> to load the course.
          </p>
        )}
        {sections.map((section) => (
          <section key={section.name}>
            <h2 className="text-xl font-semibold mb-4">{section.name}</h2>
            <div className="bp-row">
              {section.episodes.map((ep) => (
                <EpisodeCard key={ep.slug} episode={ep} progress={progress[ep.slug]} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
