"use client";

import { useEffect, useState } from "react";
import type { PublicPortfolio } from "@/lib/btc-portfolio/schema";
import { watchPortfolio, type PortfolioFreshness } from "@/lib/btc-portfolio/refresh";
import PortfolioDashboard from "./PortfolioDashboard";

/** Public releases only. Admin draft previews deliberately do not subscribe to this feed. */
export default function PortfolioAutoRefresh({ data }: { data: PublicPortfolio }) {
  const [snapshot, setSnapshot] = useState<{ data: PublicPortfolio; freshness: PortfolioFreshness }>({ data, freshness: { status: "checking", checkedAt: null } });
  useEffect(() => {
    const watcher = watchPortfolio({
      isActive: () => document.visibilityState === "visible" && navigator.onLine,
      onData: result => setSnapshot({ data: result.data, freshness: { status: "ready", checkedAt: result.checkedAt } }),
      onError: () => setSnapshot(previous => ({ ...previous, freshness: { ...previous.freshness, status: navigator.onLine ? "error" : "offline" } })),
    });
    const resume = () => { void watcher.refresh(); };
    const visibility = () => { if (document.visibilityState === "visible") resume(); else watcher.cancel(); };
    const offline = () => { watcher.cancel(); setSnapshot(previous => ({ ...previous, freshness: { ...previous.freshness, status: "offline" } })); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    return () => {
      watcher.stop();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
    };
  }, []);
  return <PortfolioDashboard data={snapshot.data} freshness={snapshot.freshness}/>;
}
