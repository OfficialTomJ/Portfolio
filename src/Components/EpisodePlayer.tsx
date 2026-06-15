"use client";

import { useEffect, useRef, useState } from "react";
import { FaCheck } from "react-icons/fa";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return apiPromise;
}

export default function EpisodePlayer({
  youtubeId,
  slug,
  initialCompleted,
  initialSeconds,
}: {
  youtubeId: string;
  slug: string;
  initialCompleted: boolean;
  initialSeconds: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(initialCompleted);
  const [completed, setCompleted] = useState(initialCompleted);

  // Resume from saved position unless already completed.
  const resumeAt =
    !initialCompleted && initialSeconds > 2 ? Math.floor(initialSeconds) : 0;

  function snapshot(): { percent: number; seconds: number } {
    const p = playerRef.current;
    if (!p?.getDuration) return { percent: 0, seconds: 0 };
    const dur = p.getDuration() || 0;
    const cur = p.getCurrentTime() || 0;
    return { percent: dur ? (cur / dur) * 100 : 0, seconds: cur };
  }

  function sendProgress(completedFlag?: boolean) {
    const { percent, seconds } = snapshot();
    fetch("/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        episodeSlug: slug,
        percent,
        seconds,
        completed: completedFlag,
      }),
      keepalive: true,
    }).catch(() => {});
  }

  function markDone() {
    if (doneRef.current) return;
    doneRef.current = true;
    setCompleted(true);
    sendProgress(true);
  }

  useEffect(() => {
    let cancelled = false;
    loadYouTubeAPI().then(() => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1, start: resumeAt },
        events: {
          onStateChange: (e: any) => {
            const YT = window.YT;
            if (e.data === YT.PlayerState.PLAYING) {
              intervalRef.current = setInterval(() => {
                const { percent } = snapshot();
                if (percent > 0) sendProgress();
                if (percent >= 95) markDone();
              }, 10000);
            } else {
              if (intervalRef.current) clearInterval(intervalRef.current);
              if (e.data === YT.PlayerState.PAUSED) {
                if (snapshot().percent > 0) sendProgress();
              } else if (e.data === YT.PlayerState.ENDED) {
                markDone();
              }
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId, slug]);

  function toggleComplete() {
    const next = !completed;
    doneRef.current = next;
    setCompleted(next);
    sendProgress(next);
  }

  return (
    <div>
      <div className="relative aspect-video rounded-xl overflow-hidden bp-surface">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      </div>
      <div className="mt-4">
        <button
          onClick={toggleComplete}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            completed
              ? "bg-[var(--bp-accent)] text-black"
              : "border border-[var(--bp-border-strong)] hover:bg-white/5"
          }`}
        >
          <FaCheck className="text-xs" /> {completed ? "Completed" : "Mark complete"}
        </button>
      </div>
    </div>
  );
}
