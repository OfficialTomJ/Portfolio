"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "../lib/auth-client";
import {
  DISCLOSURE_VERSION,
  DISCLOSURE_TITLE,
  DISCLOSURE_SECTIONS,
  isAcceptanceValid,
} from "../lib/disclosure-config";

const STORAGE_KEY = "bp-disclosure";

type StoredAcceptance = { version: number; acceptedAt: string };

function readLocal(): StoredAcceptance | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAcceptance) : null;
  } catch {
    return null;
  }
}

function writeLocal(a: StoredAcceptance) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    /* ignore (private mode / disabled storage) */
  }
}

/**
 * Hard-gating "not financial advice" disclosure shown on Blueprint pages.
 * The visitor must scroll the text, tick the box, then acknowledge. Acceptance
 * persists to localStorage for everyone and to the account for logged-in users
 * (so it follows them across devices); it re-prompts yearly or on version bump.
 */
export default function DisclosureModal() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  // Show on the mentor landing page and all blueprint pages, but not on the
  // auth/account pages (sign-in, sign-up, verify-email, reset-password, account).
  const onDisclosurePage =
    pathname === "/" || (pathname?.startsWith("/blueprint") ?? false);

  // Lazy-init from localStorage so a valid prior acceptance never flashes the modal.
  const [accepted, setAccepted] = useState<boolean>(() =>
    isAcceptanceValid(readLocal())
  );
  const [reachedBottom, setReachedBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The server can't read localStorage, so it always renders "not accepted".
  // `hydrated` is false during SSR and the first client render, then true after
  // hydration — so the first client render matches the server's (no mismatch),
  // and we only consult the localStorage-derived state once on the client.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const open = hydrated && onDisclosurePage && !accepted;

  // Reconcile with the account for logged-in users.
  useEffect(() => {
    if (!onDisclosurePage || !session?.user || accepted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/disclosure");
        if (!res.ok) return;
        const { acceptance } = await res.json();
        if (cancelled) return;
        if (isAcceptanceValid(acceptance)) {
          writeLocal({
            version: acceptance.version,
            acceptedAt: new Date(acceptance.acceptedAt).toISOString(),
          });
          setAccepted(true);
        } else {
          // Server has nothing valid, but this device already accepted — backfill.
          const local = readLocal();
          if (isAcceptanceValid(local)) {
            fetch("/api/disclosure", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ version: DISCLOSURE_VERSION }),
            }).catch(() => {});
            setAccepted(true);
          }
        }
      } catch {
        /* network error — fall back to localStorage-only behaviour */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onDisclosurePage, session?.user, accepted]);

  // Lock background scroll while the gate is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // If the content fits without scrolling, treat it as already read.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.clientHeight <= 4) setReachedBottom(true);
  }, [open]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
      setReachedBottom(true);
    }
  }

  function acknowledge() {
    const acceptedAt = new Date().toISOString();
    writeLocal({ version: DISCLOSURE_VERSION, acceptedAt });
    if (session?.user) {
      // Best-effort: don't block unverified/offline users on the network call.
      fetch("/api/disclosure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: DISCLOSURE_VERSION }),
      }).catch(() => {});
    }
    setAccepted(true);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclosure-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="bp-surface flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl p-6 sm:p-8">
        <h2
          id="disclosure-title"
          className="text-xl font-semibold text-[var(--bp-text)]"
        >
          {DISCLOSURE_TITLE}
        </h2>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-md border border-[var(--bp-border)] bg-black/30 p-4 text-sm leading-relaxed text-[var(--bp-text-dim)]"
        >
          {DISCLOSURE_SECTIONS.map((s, i) => (
            <div key={i}>
              {s.heading && (
                <h3 className="mb-1 text-sm font-semibold text-[var(--bp-text)]">
                  {s.heading}
                </h3>
              )}
              <p>{s.body}</p>
            </div>
          ))}
        </div>

        <label
          className={`mt-4 flex items-start gap-3 text-sm text-[var(--bp-text)] ${
            reachedBottom ? "cursor-pointer" : "cursor-not-allowed opacity-50"
          }`}
        >
          <input
            type="checkbox"
            disabled={!reachedBottom}
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--bp-accent)]"
          />
          <span>
            I have read, understood and accept this disclosure.
            {!reachedBottom && (
              <span className="block text-xs text-[var(--bp-text-dim)]">
                Scroll to the bottom of the text above to enable this.
              </span>
            )}
          </span>
        </label>

        <button
          type="button"
          disabled={!checked}
          onClick={acknowledge}
          className="mt-5 w-full rounded-md bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Accept &amp; continue
        </button>
      </div>
    </div>
  );
}
