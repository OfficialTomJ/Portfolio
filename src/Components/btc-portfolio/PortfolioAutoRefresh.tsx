"use client";

import { useEffect, useState } from "react";
import type { PublicPortfolio } from "@/lib/btc-portfolio/schema";
import { watchPortfolio, type PortfolioFreshness } from "@/lib/btc-portfolio/refresh";
import { portfolioHeadCopyForData } from "@/lib/btc-portfolio/head-copy";
import { revaluePortfolio, valuationAssets } from "@/lib/btc-portfolio/live-valuation";
import { watchMarketPrices, type MarketPrices } from "@/lib/btc-portfolio/market-prices";
import PortfolioDashboard from "./PortfolioDashboard";

/** Public releases only. Admin draft previews deliberately do not subscribe to this feed. */
export default function PortfolioAutoRefresh({ data }: { data: PublicPortfolio }) {
  const [snapshot, setSnapshot] = useState<{ data: PublicPortfolio; freshness: PortfolioFreshness }>({ data, freshness: { status: "checking", checkedAt: null } });
  const [market, setMarket] = useState<MarketPrices>({ quotes: {}, status: "connecting" });
  const delayed = snapshot.data.valuation?.status === "delayed";
  const title = portfolioHeadCopyForData(snapshot.data).title;
  let symbols = "BTC";
  try { symbols = valuationAssets(snapshot.data).join(","); } catch { /* Unsupported holdings retain the accepted snapshot. */ }
  useEffect(() => {
    const watcher = watchMarketPrices(symbols.split(","), state => {
      setMarket(state);
      if (state.status === "live") setSnapshot(previous => {
        try { return { ...previous, data: revaluePortfolio(previous.data, state.quotes) }; }
        catch { return previous; /* A complete, fresh price set is required to advance every percentage together. */ }
      });
    });
    const visibility = () => { if (document.visibilityState === "visible" && navigator.onLine) watcher.resume(); else watcher.pause(); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("online", visibility); window.addEventListener("offline", visibility);
    visibility();
    return () => { watcher.stop(); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("online", visibility); window.removeEventListener("offline", visibility); };
  }, [symbols]);
  useEffect(() => { document.title = title; }, [title]);
  useEffect(() => {
    const watcher = watchPortfolio({
      // Keep the tab-bar return current in background tabs too.
      isActive: () => navigator.onLine,
      onData: result => setSnapshot(previous => {
        const sameRelease = previous.data.release === result.data.release && previous.data.publishedAt === result.data.publishedAt;
        // A slower REST response must not roll back a more recent streamed valuation.
        const next = sameRelease && previous.data.asOf > result.data.asOf ? previous.data : result.data;
        return { data: next, freshness: { status: result.data.valuation?.status === "delayed" ? "error" : "ready", checkedAt: result.checkedAt } };
      }),
      onError: () => setSnapshot(previous => ({ ...previous, freshness: { ...previous.freshness, status: navigator.onLine ? "error" : "offline" } })),
    });
    const resume = () => { void watcher.refresh(); };
    const visibility = () => { if (document.visibilityState === "visible") resume(); };
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
  return <PortfolioDashboard data={snapshot.data} marketPrices={market} freshness={{ ...snapshot.freshness, status: delayed && snapshot.freshness.status === "ready" ? "error" : snapshot.freshness.status }}/>;
}
