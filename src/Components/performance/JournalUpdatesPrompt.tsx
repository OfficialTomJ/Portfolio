"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FaArrowRightLong, FaXmark } from "react-icons/fa6";

export default function JournalUpdatesPrompt() {
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const dismiss = () => {
    setVisible(false);
    setOpen(false);
  };

  return (
    <>
      {visible && (
        <aside className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-xl items-stretch overflow-hidden rounded-xl border border-[#ff6719]/25 bg-[#101011]/95 shadow-2xl shadow-black/60 backdrop-blur-xl sm:bottom-5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[#ff6719]/[0.055] sm:px-5"
            aria-haspopup="dialog"
          >
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.17em] text-[#ff8b52]">Journal updates</span>
              <span className="mt-1 block break-words text-sm leading-5 text-zinc-300">Follow new closed trades and performance updates.</span>
            </span>
            <FaArrowRightLong className="shrink-0 text-xs text-[#ff8b52] transition-transform group-hover:translate-x-1" />
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss journal updates"
            className="grid w-12 shrink-0 place-items-center border-l border-white/[0.08] text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <FaXmark />
          </button>
        </aside>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[70] grid items-end bg-black/75 p-3 backdrop-blur-sm sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-updates-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#ff6719]/20 bg-[#0a0a0b] p-5 shadow-2xl shadow-black sm:p-7"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(255,103,25,0.14),transparent_44%)]" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close journal updates"
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-zinc-600 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <FaXmark />
            </button>

            <div className="relative">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8b52]">Journal updates</p>
              <h2 id="journal-updates-title" className="mt-3 text-2xl font-medium tracking-[-0.025em] text-white">Follow the journal</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Get notified when new closed trades and performance updates are published. Subscribe for journal updates or join the community for broader market discussion.
              </p>
              <div className="mt-6 grid gap-3">
                <Link
                  href="/substack"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--bp-accent)] px-5 text-sm font-semibold text-black transition-all hover:brightness-110"
                >
                  Subscribe on Substack <FaArrowRightLong className="text-xs" />
                </Link>
                <a
                  href="https://discord.gg/8tK967YJ6y"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.035] px-5 text-sm font-medium text-zinc-200 transition-colors hover:border-white/[0.22] hover:bg-white/[0.07] hover:text-white"
                >
                  Join the Discord
                </a>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
