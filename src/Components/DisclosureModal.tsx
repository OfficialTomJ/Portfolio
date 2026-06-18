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
  const { data: session, isPending } = authClient.useSession();
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
  // True once the per-account check has resolved (or was found unnecessary), so
  // a logged-in user's DB acceptance doesn't flash the modal before it loads.
  const [serverChecked, setServerChecked] = useState(false);
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

  // We can't decide whether to show the gate until we know the user's account
  // status: while the session is loading, or while a logged-in user's DB
  // acceptance is still being fetched. During that window we show a neutral
  // cover (not the modal, not the page) so the disclosure never flashes.
  const deciding =
    !accepted && (isPending || (!!session?.user && !serverChecked));

  const open = hydrated && onDisclosurePage && !accepted && !deciding;
  const covering = hydrated && onDisclosurePage && deciding;

  // Reconcile with the account for logged-in users.
  useEffect(() => {
    // Logged out (no session.user) needs no server check — `deciding` is already
    // false in that case, so we only fetch for a signed-in user.
    if (!onDisclosurePage || isPending || accepted || !session?.user) return;
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
      } finally {
        if (!cancelled) setServerChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onDisclosurePage, isPending, session?.user, accepted]);

  // Lock background scroll while the gate (or its loading cover) is shown.
  useEffect(() => {
    if (!open && !covering) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, covering]);

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

  // Neutral full-screen cover while we determine acceptance — looks like the
  // page is still loading, and prevents the disclosure (or page content) from
  // flashing before the account check resolves.
  if (covering) {
    return <div aria-hidden className="fixed inset-0 z-[100] bg-[var(--bp-bg)]" />;
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

        <a
          href="/compliance"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-[var(--bp-accent)] underline underline-offset-2"
        >
          Open the full disclosure page ↗
        </a>

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
