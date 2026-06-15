import Link from "next/link";
import { notFound } from "next/navigation";
import { FaArrowRight, FaFilePdf } from "react-icons/fa";
import { PiArrowLeftThin } from "react-icons/pi";
import { getEpisode, getNextEpisode } from "../../../../../lib/blueprint";
import { getSession } from "../../../../../lib/session";
import { getUserProgress } from "../../../../../lib/progress";
import { getEpisodeLikeState } from "../../../../../lib/engagement";
import MarkdownOutline from "../../../../../Components/MarkdownOutline";
import EpisodePlayer from "../../../../../Components/EpisodePlayer";
import LikeButton from "../../../../../Components/LikeButton";
import Comments from "../../../../../Components/Comments";
import AccessGate from "../../../../../Components/AccessGate";

// GATED episode page. Content is only queried for verified, signed-in users.
export default async function EpisodePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.emailVerified) return <AccessGate />;

  const { slug } = await params;
  const episode = await getEpisode(slug);
  if (!episode || episode.type !== "video") notFound();

  const [next, progress, likeState] = await Promise.all([
    getNextEpisode(slug),
    getUserProgress(session.user.id),
    getEpisodeLikeState(slug, session.user.id),
  ]);
  const completed = !!progress[slug]?.completed;
  const resumeSeconds = progress[slug]?.seconds ?? 0;

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <Link
        href="/blueprint"
        className="inline-flex items-center gap-1 text-[var(--bp-text-dim)] hover:text-white transition-colors mb-4"
      >
        <PiArrowLeftThin className="text-3xl" /> Back to season
      </Link>

      {/* Video + progress */}
      <EpisodePlayer
        youtubeId={episode.youtubeId as string}
        slug={episode.slug}
        initialCompleted={completed}
        initialSeconds={resumeSeconds}
      />

      {/* Title */}
      <p className="text-[var(--bp-accent)] text-sm font-medium uppercase tracking-widest mt-6">
        Episode {episode.episodeNumber}
      </p>
      <div className="flex items-start justify-between gap-4 mt-1">
        <h1 className="text-3xl font-semibold">{episode.title}</h1>
        <LikeButton
          slug={episode.slug}
          initialLiked={likeState.liked}
          initialCount={likeState.count}
        />
      </div>

      {/* Outline */}
      {episode.outlineMarkdown && (
        <div className="mt-6">
          <MarkdownOutline markdown={episode.outlineMarkdown} />
        </div>
      )}

      {/* Next episode */}
      {next && (
        <Link
          href={
            next.type === "resource"
              ? `/api/resources/${next.resourceSlug}`
              : `/blueprint/episode/${next.slug}`
          }
          className="mt-10 flex items-center justify-between bp-surface rounded-xl px-5 py-4 hover:border-[var(--bp-border-strong)] transition-colors"
        >
          <span className="flex items-center gap-3">
            {next.type === "resource" ? (
              <FaFilePdf className="text-[var(--bp-accent)]" />
            ) : null}
            <span>
              <span className="block text-xs text-[var(--bp-text-dim)]">
                Up next
              </span>
              <span className="font-medium">{next.title}</span>
            </span>
          </span>
          <FaArrowRight className="text-[var(--bp-text-dim)]" />
        </Link>
      )}

      {/* Comments */}
      <Comments episodeSlug={episode.slug} />
    </main>
  );
}
