"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { FaArrowRightLong } from "react-icons/fa6";
import { track } from "@/lib/track";

export default function JournalUpdatesPrompt() {
  const ref = useRef<HTMLElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || tracked.current) return;
      tracked.current = true;
      track("performance_cta_view", { placement: "after_results" });
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const trackClick = (channel: "substack" | "discord") => {
    track("performance_cta_click", { channel, placement: "after_results" });
  };

  return (
    <section
      ref={ref}
      aria-labelledby="journal-updates-title"
      className="relative overflow-hidden rounded-2xl border border-[#ff6719]/20 bg-[#0a0a0b]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,103,25,0.15),transparent_45%)]" />
      <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,.85fr)_minmax(28rem,1.15fr)] lg:items-center lg:gap-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8b52]">Follow the journal</p>
          <h2 id="journal-updates-title" className="mt-2 text-xl font-medium tracking-[-0.025em] text-white sm:text-2xl">
            Follow my market work.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            Read my market ideas, charts and analysis on Substack. Join Discord for timely updates, quick charts and community discussion.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="https://thomasjohnston.substack.com/?utm_source=performance_journal&utm_medium=website&utm_campaign=journal_updates&utm_content=substack"
            target="_blank"
            rel="noreferrer"
            onClick={() => trackClick("substack")}
            className="group flex min-h-20 items-center justify-between gap-4 rounded-xl bg-[var(--bp-accent)] px-4 py-3.5 text-black transition-all hover:brightness-110 sm:px-5"
          >
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">Market ideas &amp; analysis</span>
              <span className="mt-1 block text-sm font-semibold">Follow on Substack</span>
            </span>
            <FaArrowRightLong className="shrink-0 text-xs transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="https://discord.gg/8tK967YJ6y"
            target="_blank"
            rel="noreferrer"
            onClick={() => trackClick("discord")}
            className="group flex min-h-20 items-center justify-between gap-4 rounded-xl border border-white/[0.12] bg-white/[0.035] px-4 py-3.5 text-zinc-100 transition-colors hover:border-white/[0.22] hover:bg-white/[0.07] sm:px-5"
          >
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Timely updates &amp; chat</span>
              <span className="mt-1 block text-sm font-semibold">Join the Discord</span>
            </span>
            <FaArrowRightLong className="shrink-0 text-xs text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </a>
        </div>
      </div>
    </section>
  );
}
