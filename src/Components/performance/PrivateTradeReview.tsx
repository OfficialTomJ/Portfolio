import Link from "next/link";
import type { TradeAnnotation } from "@/lib/performance/annotations-model";
import { signedR } from "@/lib/performance/metrics";
import type { MarketCandles, PerformanceTrade, TradeTag } from "@/lib/performance/types";
import { InlineTradeEditor } from "./TradeEditor";
import TradePriceChart from "./TradePriceChart";
import type { AdminPublication } from "@/lib/performance/admin-publication";

const date = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const price = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: value < 100 ? 5 : 2 });

export default function PrivateTradeReview({ trade, market, status, annotation, tags, nextTradeId, publication }: {
  trade: PerformanceTrade; market: MarketCandles | null; status: "published" | "pending_review";
  annotation: TradeAnnotation; tags: TradeTag[]; nextTradeId: string | null;
  publication: AdminPublication;
}) {
  return <main className="min-h-[calc(100vh-4rem)] pb-12">
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
      <Link href="/performance/review" className="inline-block min-h-10 py-2 text-sm text-zinc-400 hover:text-white">← Review journal</Link>
      <header className="mt-3 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-zinc-500">Private</span><span className={`rounded border px-2 py-1 font-semibold ${trade.direction === "Long" ? "border-[#22c55e]/30 text-[#22c55e]" : "border-[#ef4444]/30 text-[#ef4444]"}`}>{trade.direction.toUpperCase()}</span><span className="rounded border border-white/10 px-2 py-1 text-zinc-400">{status === "published" ? "Published" : "Unpublished"}</span></div><h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{trade.symbol.replace("USDT", " / USDT")}</h1><p className="mt-2 text-xs leading-5 text-zinc-500">Closed {date.format(new Date(trade.closedAt))} GMT</p></div>
        <div className="shrink-0"><p className="text-xs text-zinc-500">Actual R</p><p className="mt-1 text-3xl font-medium tabular-nums text-[#ff8b52]">{signedR(trade.resultR)}</p></div>
      </header>
      <div className="mt-5 space-y-5" aria-label="Chart and review">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]" aria-label="Trade price action">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4 sm:p-5"><h2 className="text-base font-medium">{trade.direction} entry to exit</h2><p className="text-xs text-zinc-500">{market?.source === "bybit" ? "Bybit" : "Binance"} prices</p></header>
          <div className="p-2 sm:p-3">{market ? <TradePriceChart trade={trade} candles={market.candles} source={market.source} initialInterval="4h" /> : <div className="grid h-80 place-items-center text-sm text-zinc-500">Market chart unavailable</div>}</div>
          <dl className="grid grid-cols-2 gap-4 border-t border-white/10 p-4 sm:p-5"><div className="min-w-0"><dt className="text-xs text-zinc-500">Entry</dt><dd className="mt-1 break-words text-lg text-zinc-200">{price(trade.entryPrice)}</dd><dd className="mt-1 text-xs leading-5 text-zinc-500">{date.format(new Date(trade.openedAt))} GMT</dd></div><div className="min-w-0"><dt className="text-xs text-zinc-500">Exit</dt><dd className="mt-1 break-words text-lg text-zinc-200">{price(trade.exitPrice)}</dd><dd className="mt-1 text-xs leading-5 text-zinc-500">{date.format(new Date(trade.closedAt))} GMT</dd></div></dl>
        </section>
        <InlineTradeEditor trade={trade} initialAnnotation={annotation} initialTags={tags} nextTradeId={nextTradeId} initialPublication={publication} />
      </div>
      {status === "published" && <Link href={`/performance/trades/${trade.id}`} className="mt-5 inline-block min-h-10 py-2 text-xs text-zinc-500 hover:text-white">View public trade page ↗</Link>}
    </div>
  </main>;
}
