"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminSyncControl({ lastSyncAt }: { lastSyncAt: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const syncedAt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(lastSyncAt));

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/performance/admin/sync", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 409) {
        setMessage("A sync is already running. Try again shortly.");
        return;
      }
      if (!response.ok) {
        setMessage("Sync failed. The last successful results remain available.");
        return;
      }
      setMessage("Sync complete. Refreshing results.");
      router.refresh();
    } catch {
      setMessage("Could not reach the sync service. The last results remain available.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-zinc-500">Last synced {syncedAt} GMT</span>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="min-h-10 rounded-lg border border-[#ff6719]/30 bg-[#ff6719]/[0.09] px-4 text-sm font-medium text-[#ffad83] transition-colors hover:bg-[#ff6719]/[0.16] disabled:cursor-wait disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {message && <p role="status" className="text-xs text-zinc-400">{message}</p>}
    </div>
  );
}
