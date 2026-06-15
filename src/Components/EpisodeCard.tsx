import Link from "next/link";
import { FaPlay, FaFilePdf, FaCheck } from "react-icons/fa";
import type { Episode } from "../lib/blueprint";

// A Netflix-style episode tile with optional watch progress.
export default function EpisodeCard({
  episode,
  progress,
}: {
  episode: Episode;
  progress?: { completed: boolean; percent: number };
}) {
  const isResource = episode.type === "resource";
  const href = isResource
    ? `/api/resources/${episode.resourceSlug}`
    : `/blueprint/episode/${episode.slug}`;
  const thumb = episode.youtubeId
    ? `https://img.youtube.com/vi/${episode.youtubeId}/hqdefault.jpg`
    : null;

  return (
    <Link
      href={href}
      className="bp-card group block w-[260px] sm:w-[300px]"
      {...(isResource ? { target: "_blank" } : {})}
    >
      <div className="relative aspect-video rounded-lg overflow-hidden bp-surface transition-all duration-300 group-hover:scale-[1.04] group-hover:border-[var(--bp-border-strong)]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={episode.title}
            className="w-full h-full object-cover brightness-[0.7] group-hover:brightness-90 transition-all"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#ff6719]/20 to-black flex items-center justify-center">
            <FaFilePdf className="text-3xl text-[var(--bp-accent)]" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="rounded-full bg-white/90 text-black w-12 h-12 flex items-center justify-center">
            {isResource ? <FaFilePdf /> : <FaPlay className="ml-0.5" />}
          </div>
        </div>
        {progress?.completed && (
          <div className="absolute top-2 left-2 flex items-center gap-1 text-xs bg-black/70 rounded px-2 py-0.5">
            <FaCheck className="text-[var(--bp-accent)] text-[10px]" /> Watched
          </div>
        )}
        {progress && progress.percent > 0 && !progress.completed && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-[var(--bp-accent)]"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-xs text-[var(--bp-text-dim)]">
          {isResource ? "Bonus resource" : `Episode ${episode.episodeNumber}`}
        </p>
        <p className="text-sm font-medium leading-snug line-clamp-2">
          {episode.title}
        </p>
      </div>
    </Link>
  );
}
