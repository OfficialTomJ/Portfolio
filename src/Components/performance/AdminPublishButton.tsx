"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaCheck } from "react-icons/fa6";
import type { PerformanceTrade } from "@/lib/performance/types";
import { signedR } from "@/lib/performance/metrics";

export default function AdminPublishButton({
  trade,
  fingerprint,
  onMessage,
  anotherPublicationInProgress,
  onPublicationStateChange,
}: {
  trade: PerformanceTrade;
  fingerprint: string;
  onMessage: (message: string) => void;
  anotherPublicationInProgress: boolean;
  onPublicationStateChange: (tradeId: string | null) => void;
}) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);

  async function publish() {
    if (publishing || anotherPublicationInProgress) return;
    const label = `${trade.symbol.replace("USDT", " / USDT")} ${trade.direction} (${signedR(trade.resultR)})`;
    if (!window.confirm(`Publish ${label} to the public Performance Journal?`)) return;

    setPublishing(true);
    onPublicationStateChange(trade.id);
    onMessage(`Publishing ${label}…`);
    try {
      const response = await fetch(`/api/performance/admin/review/${encodeURIComponent(trade.id)}/publish`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint }),
      });
      const result = await response.json();
      if (response.ok && result.published === true) {
        onMessage(`${label} is live. Refreshing results.`);
        router.refresh();
      } else if (result.approvalRecorded) {
        onMessage("Approval was recorded, but publication is not confirmed. Refresh after the next sync before trying again.");
        router.refresh();
      } else if (response.status === 409) {
        onMessage("This trade changed since review. Sync and inspect the current result before publishing.");
        router.refresh();
      } else {
        onMessage("Could not publish this trade. It remains pending. Try again after checking the sync status.");
      }
    } catch {
      onMessage("Publication could not be confirmed. Refresh the page and check whether this trade is live before trying again.");
    } finally {
      setPublishing(false);
      onPublicationStateChange(null);
    }
  }

  return (
    <div className="flex shrink-0 items-center border-l border-white/[0.07] px-2 sm:px-3">
      <button
        type="button"
        onClick={publish}
        disabled={publishing || anotherPublicationInProgress}
        aria-label={`Publish ${trade.symbol} ${trade.direction} result`}
        title="Approve and publish this result"
        className="grid size-10 place-items-center rounded-lg border border-[#ff6719]/30 bg-[#ff6719]/[0.08] text-[#ffad83] transition-colors hover:bg-[#ff6719]/[0.18] focus-visible:outline focus-visible:outline-[#ff6719] disabled:cursor-wait disabled:opacity-50"
      >
        {publishing ? <span className="text-[10px]">…</span> : <FaCheck aria-hidden="true" className="text-sm" />}
      </button>
    </div>
  );
}
