"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { PerformanceTrade, TradeType } from "@/lib/performance/types";
import { signedR } from "@/lib/performance/metrics";
import { publicationOutcome } from "@/lib/performance/admin-publication";

const date = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Shared explicit approval flow for quick publishing and both review editors. */
export default function AdminPublishButton({ trade, fingerprint, onMessage, anotherPublicationInProgress = false, onPublicationStateChange,
  onPublished, disabled = false, label = "Publish", tradeType, description, className = "",
}: {
  trade: PerformanceTrade; fingerprint: string; onMessage: (message: string) => void;
  anotherPublicationInProgress?: boolean; onPublicationStateChange?: (tradeId: string | null) => void;
  onPublished?: () => void;
  disabled?: boolean; label?: string; tradeType?: TradeType | null; description?: string; className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "publishing">("idle");
  const [error, setError] = useState("");
  const [recheck, setRecheck] = useState(false);
  const [published, setPublished] = useState(false);
  const locked = useRef(false);
  const busy = phase !== "idle";
  const action = label;

  async function publish() {
    if (locked.current || disabled || anotherPublicationInProgress || recheck) return;
    locked.current = true; setError(""); onPublicationStateChange?.(trade.id);
    let submitted = false;
    try {
      setPhase("publishing"); submitted = true;
      const response = await fetch(`/api/performance/admin/review/${encodeURIComponent(trade.id)}/publish`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint }),
      });
      const outcome = publicationOutcome(response.status, await response.json());
      const message = outcome.message;
      onMessage(message);
      if (outcome.kind === "published") {
        setPublished(true); setOpen(false); onPublished?.(); router.refresh();
      } else { setError(message); setRecheck(outcome.recheck); }
    } catch (cause) {
      const message = submitted
        ? publicationOutcome(0, {}).message
        : `Nothing was submitted for publication. ${cause instanceof Error ? cause.message : "Changes could not be saved."}`;
      setError(message); onMessage(message); setRecheck(submitted);
    } finally {
      setPhase("idle"); locked.current = false; onPublicationStateChange?.(null);
    }
  }

  if (published) return <span className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-3 text-sm text-zinc-500 ${className}`}>Published</span>;
  return <>
    <button type="button" onClick={() => { setError(""); setOpen(true); }} disabled={disabled || busy || anotherPublicationInProgress || recheck}
      aria-label={`${action} ${trade.symbol} ${trade.direction} result`}
      className={`min-h-11 rounded-lg border border-[#ff6719]/30 bg-[#ff6719]/[0.08] px-3 py-2.5 text-sm text-[#ffad83] hover:bg-[#ff6719]/[0.18] focus-visible:outline focus-visible:outline-[#ff6719] disabled:opacity-40 ${className}`}>{recheck ? "Refresh to verify" : action}</button>
    {open && <PublicationDialog trade={trade} tradeType={tradeType} description={description} busy={busy} error={error} recheck={recheck}
      onClose={() => { if (!locked.current) setOpen(false); }} onConfirm={publish} />}
  </>;
}

function PublicationDialog({ trade, tradeType, description, busy, error, recheck, onClose, onConfirm }: {
  trade: PerformanceTrade; tradeType?: TradeType | null; description?: string; busy: boolean;
  error: string; recheck: boolean;
  onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialog} aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#07090d] p-0 text-zinc-100 backdrop:bg-black/80">
    <div className="space-y-5 p-5 sm:p-6">
      <header><h2 id={id} className="text-xl font-medium">Publish this trade?</h2><p className="mt-2 text-sm leading-6 text-zinc-400">This result will appear in the public Performance Journal.</p></header>
      <div className="rounded-xl border border-white/10 bg-black p-4">
        <p className="break-words font-medium">{trade.symbol.replace("USDT", " / USDT")} <span className={`ml-2 text-xs ${trade.direction === "Long" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{trade.direction.toUpperCase()}</span></p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">Closed {date.format(new Date(trade.closedAt))} GMT</p>
        <p className="mt-3 text-2xl tabular-nums text-[#ff8b52]">{signedR(trade.resultR)}</p>
        {tradeType && <p className="mt-3 text-xs text-zinc-300">Trade type: {tradeType}</p>}
        {description?.trim() && <div className="mt-4 border-t border-white/10 pt-3"><p className="text-xs text-zinc-500">Public description</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">{description}</p></div>}
      </div>
      <p className="text-xs leading-5 text-zinc-500">ASR, strategies and private notes stay private.</p>
      {error && <p role="alert" className="break-words text-sm leading-6 text-red-300">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 disabled:opacity-40">{recheck ? "Close" : "Cancel"}</button>
        {recheck ? <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-lg bg-[#ff6719] px-4 py-2 text-sm font-medium text-black">Refresh status</button>
          : <button type="button" onClick={onConfirm} disabled={busy} className="min-h-11 rounded-lg bg-[#ff6719] px-4 py-2 text-sm font-medium text-black disabled:opacity-40">{busy ? "Publishing…" : "Publish trade"}</button>}
      </div>
    </div>
  </dialog>;
}
