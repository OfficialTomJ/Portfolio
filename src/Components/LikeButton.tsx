"use client";

import { useState } from "react";
import { FaRegThumbsUp, FaThumbsUp } from "react-icons/fa";

export default function LikeButton({
  slug,
  initialLiked,
  initialCount,
}: {
  slug: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const prevLiked = liked;
    const prevCount = count;
    // optimistic
    setLiked(!prevLiked);
    setCount(prevCount + (prevLiked ? -1 : 1));
    try {
      const r = await fetch(`/api/episodes/${slug}/like`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setLiked(d.liked);
        setCount(d.count);
      } else {
        setLiked(prevLiked);
        setCount(prevCount);
      }
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        liked
          ? "bg-[var(--bp-accent)] text-black"
          : "border border-[var(--bp-border-strong)] hover:bg-white/5"
      }`}
    >
      {liked ? <FaThumbsUp /> : <FaRegThumbsUp />} {count}
    </button>
  );
}
