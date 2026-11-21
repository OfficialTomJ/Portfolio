"use client";

import { useEffect, useState } from "react";
import type { PublicPortfolio } from "@/lib/btc-portfolio/schema";
import { marketAssets, watchMarketPrices, type MarketAsset, type MarketPrices } from "@/lib/btc-portfolio/market-prices";
import { date } from "@/lib/btc-portfolio/view";
import AssetLogo from "@/Components/spot/AssetLogo";
import { portfolioUpdateTime } from "./PortfolioRefreshIndicator";

const assetNames: Record<string, string> = { BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", HYPE: "Hyperliquid", FARTCOIN: "Fartcoin" };
const formatPrice = (price: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);

export default function PortfolioAllocation({ data, livePrices, marketPrices }: { data: PublicPortfolio; livePrices: boolean; marketPrices?: MarketPrices }) {
  const totals = new Map<string, number>();
  for (const row of data.allocation) if (row.type !== "cash") totals.set(row.asset, (totals.get(row.asset) ?? 0) + row.weight);
  const allocation = [...totals].filter(([, weight]) => Math.abs(weight) > .000001).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const symbols = marketAssets.filter(asset => totals.has(asset)).join(",");
  const [localMarket, setMarket] = useState<MarketPrices>({ quotes: {}, status: "connecting" });
  const market = marketPrices ?? localMarket;
  const sharedMarket = marketPrices !== undefined;
  useEffect(() => {
    if (!livePrices || !symbols || sharedMarket) return;
    const watcher = watchMarketPrices(symbols.split(","), setMarket);
    const visibility = () => { if (document.visibilityState === "visible" && navigator.onLine) watcher.resume(); else watcher.pause(); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("online", visibility); window.addEventListener("offline", visibility);
    visibility();
    return () => { watcher.stop(); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("online", visibility); window.removeEventListener("offline", visibility); };
  }, [livePrices, symbols, sharedMarket]);
  const scale = Math.max(100, Math.ceil(Math.max(...allocation.map(([, weight]) => Math.abs(weight)), Math.abs(data.cashPct)) / 25) * 25);
  const quoteTimes = allocation.flatMap(([asset]) => market.quotes[asset as MarketAsset]?.at ? [market.quotes[asset as MarketAsset]!.at] : []).sort();
  const latestQuote = quoteTimes.at(-1);
  return <section aria-labelledby="allocation-title" className="min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-[#0a0a0c]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.06] px-5 py-5 sm:px-7">
      <h2 id="allocation-title" title="Combined across all accounts. Percentages use total portfolio equity." className="text-lg font-medium tracking-tight text-zinc-200">Current allocation</h2>
      <p className="text-xs text-zinc-500"><span className="tabular-nums text-zinc-200">{data.investedPct.toFixed(1)}%</span> invested</p>
    </div>
    <div className="space-y-5 p-5 sm:px-7 sm:py-5">
      <div className="grid grid-cols-[minmax(0,1fr)_88px_58px] items-center gap-x-2 text-[10px] text-zinc-500 sm:grid-cols-[minmax(0,1fr)_140px_90px]"><span>Asset</span><span className="text-right">Price · USD</span><span className="text-right">Allocation</span></div>
      {allocation.map(([ticker, weight]) => {
        const quote = livePrices ? market.quotes[ticker as MarketAsset] : undefined;
        return <div key={ticker}><div className="mb-2.5 grid grid-cols-[minmax(0,1fr)_88px_58px] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_140px_90px]">
          <span className="flex min-w-0 items-center gap-2 text-xs text-zinc-200 sm:gap-2.5 sm:text-sm"><AssetLogo asset={ticker}/><span className="truncate">{ticker}</span><span className="hidden text-xs text-zinc-600 sm:inline lg:hidden xl:inline">{assetNames[ticker] ?? ticker}</span></span>
          <span aria-label={`Current ${ticker} market price in USD`} title={quote ? `Public Kraken unit price · ${date(quote.at)} at ${portfolioUpdateTime(quote.at)}` : "Current market price unavailable"} className="text-right text-xs tabular-nums text-zinc-300 sm:text-sm">{quote ? formatPrice(quote.price) : "—"}</span>
          <span className={`text-right text-xs tabular-nums sm:text-sm ${weight < 0 ? "text-rose-300" : "text-zinc-200"}`}>{weight.toFixed(2)}%</span>
        </div><div className="h-1.5 rounded-full bg-white/5"><div className={`h-full rounded-full ${weight < 0 ? "bg-rose-400/70" : ticker === "BTC" ? "bg-[#d4a75b]" : "bg-[#ff8b52]/75"}`} style={{ width: `${Math.abs(weight) / scale * 100}%` }}/></div></div>;
      })}
      <div><div className="mb-2.5 grid grid-cols-[minmax(0,1fr)_88px_58px] items-center gap-x-2 text-xs sm:grid-cols-[minmax(0,1fr)_140px_90px] sm:text-sm"><span className="flex items-center gap-2 text-zinc-200"><AssetLogo asset="CASH"/>Cash</span><span className="text-right text-zinc-600">—</span><span className="text-right tabular-nums text-zinc-200">{data.cashPct.toFixed(2)}%</span></div><div className="h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full bg-slate-500" style={{ width: `${Math.abs(data.cashPct) / scale * 100}%` }}/></div></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-white/[.06] px-5 py-3 text-[10px] text-zinc-500 sm:px-7">
      {livePrices && symbols && <div aria-label="Market price status" className="flex flex-wrap items-center gap-x-2 gap-y-1"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${market.status === "live" ? "bg-[#7ad9b6]" : market.status === "delayed" || market.status === "paused" ? "bg-amber-300" : "bg-zinc-500"}`}/><span>{market.status === "live" ? "Live prices" : market.status === "connecting" ? "Connecting…" : market.status === "paused" ? "Prices paused" : "Prices delayed"} · Kraken</span>{latestQuote && <time dateTime={latestQuote}>{portfolioUpdateTime(latestQuote)}</time>}</div>}
      <span>Allocation · <time dateTime={data.asOf}>{date(data.asOf)}</time></span>
    </div>
    {(data.investedPct > 100 || data.netPct !== data.investedPct) && <p className="border-t border-white/[.06] px-5 py-3 text-[11px] leading-5 text-zinc-500 sm:px-7">{data.investedPct > 100 ? "Borrowing can take invested exposure above 100%." : ""}{data.netPct !== data.investedPct ? " Asset rows show net positions; invested exposure includes longs and shorts." : ""}</p>}
  </section>;
}
