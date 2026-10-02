import Link from "next/link";
import { FaArrowLeftLong } from "react-icons/fa6";
import JournalUpdatesPrompt from "./JournalUpdatesPrompt";
import TradePriceChart from "./TradePriceChart";
import { signedR } from "@/lib/performance/metrics";
import type { MarketCandles, PerformanceTrade, TradeTag } from "@/lib/performance/types";
import type { TradeAnnotation } from "@/lib/performance/annotations-model";
import AdminTradeReview from "./AdminTradeReview";

const fullDate = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

function price(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: value < 1000 ? 2 : 0,
    maximumFractionDigits: value < 1000 ? 2 : 0,
  });
}

function duration(openedAt: string, closedAt: string): string {
  const hours = (Date.parse(closedAt) - Date.parse(openedAt)) / 3_600_000;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours - days * 24);
  return days ? `${days}d ${remaining}h` : `${Math.round(hours)}h`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/[0.07] px-4 py-4 last:border-0 sm:px-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className="mt-2 break-words text-lg font-medium leading-tight tabular-nums text-zinc-200">{value}</p>
    </div>
  );
}

export default function TradeDetailView({
  trade,
  market,
  reviewStatus,
  annotation,
  tagCatalogue = [],
}: {
  trade: PerformanceTrade;
  market: MarketCandles | null;
  reviewStatus?: "published" | "pending_review";
  annotation?: TradeAnnotation;
  tagCatalogue?: TradeTag[];
}) {
  const privateReview = !!reviewStatus;
  const pending = reviewStatus === "pending_review";
  const backHref = privateReview ? "/performance/review" : "/performance";
  const backLabel = privateReview ? "Private review" : "Performance journal";

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-24">
      <div className="mx-auto max-w-7xl px-4 pt-7 sm:px-6 sm:pt-10">
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white">
          <FaArrowLeftLong className="text-xs" /> {backLabel}
        </Link>

        <header className="mt-7 flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-[#ff6719]/20 bg-[#ff6719]/[0.07] px-2.5 py-1 font-medium uppercase tracking-[0.14em] text-[#ff8b52]">
                {pending ? "Pending review · admin only" : privateReview ? "Published · admin view" : "Verified result"}
              </span>
              <span className={`rounded-full border px-3 py-1 font-semibold uppercase tracking-[0.14em] ${trade.direction === "Long" ? "border-[#22c55e]/35 bg-[#22c55e]/[0.10] text-[#22c55e]" : "border-[#ef4444]/35 bg-[#ef4444]/[0.10] text-[#ef4444]"}`}>
                {trade.direction} {trade.direction === "Long" ? "↑" : "↓"}
              </span>
              <span className="text-zinc-600">Closed · Simulated prop trading</span>
            </div>
            <h1 className="mt-4 break-words text-4xl font-medium leading-tight tracking-[-0.04em] text-white sm:text-5xl">
              {trade.symbol.replace("USDT", " / USDT")}
            </h1>
            <p className="mt-3 break-words text-sm leading-6 text-zinc-400">
              {trade.direction} position · {duration(trade.openedAt, trade.closedAt)} · Closed {fullDate.format(new Date(trade.closedAt))}
            </p>
            {!!trade.tags?.length && <div className="mt-3 flex flex-wrap gap-2">{trade.tags.map((tag) => <span key={tag.id} className="rounded border border-white/15 px-2 py-1 text-xs text-zinc-300">{tag.name}</span>)}</div>}
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">Net result</p>
            <p className={`mt-1 text-4xl font-medium tracking-tight ${trade.resultR >= 0 ? "text-[var(--bp-accent)]" : "text-zinc-200"}`}>
              {signedR(trade.resultR)}
            </p>
          </div>
        </header>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07090d]">
          <div className="flex flex-col gap-2 border-b border-white/[0.08] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Price action</p>
              <h2 className="mt-1 text-lg font-medium">{trade.direction} entry to exit</h2>
            </div>
            <p className="text-xs text-zinc-600">
              {market ? `${market.source === "bybit" ? "Bybit" : "Binance"} prices · ` : ""}
              Drag or scroll to explore history
            </p>
          </div>
          <div className="p-2 sm:p-4">
            {market ? (
              <TradePriceChart trade={trade} candles={market.candles} source={market.source} initialInterval="4h" />
            ) : (
              <div className="grid h-[360px] place-items-center text-sm text-zinc-600 sm:h-[500px]">Market chart unavailable</div>
            )}
          </div>
          <div className="grid grid-cols-2 border-t border-white/[0.08]">
            <Detail label="Entry" value={price(trade.entryPrice)} />
            <Detail label="Exit" value={price(trade.exitPrice)} />
          </div>
        </section>

        {privateReview && annotation && <AdminTradeReview trade={trade} annotation={annotation} tags={tagCatalogue} />}
        {trade.description && <section className="mt-6 rounded-2xl border border-white/10 bg-[#07090d] p-5 sm:p-6"><h2 className="text-base font-medium">Trade notes{privateReview && <span className="ml-2 text-xs font-normal text-zinc-500">Public description</span>}</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-400">{trade.description}</p></section>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.09] bg-[#07090d] p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Position timeline</p>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4"><dt className="text-zinc-600">Direction</dt><dd className={`font-semibold uppercase tracking-[0.12em] ${trade.direction === "Long" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{trade.direction} {trade.direction === "Long" ? "↑" : "↓"}</dd></div>
              <div className="flex items-start justify-between gap-4"><dt className="shrink-0 text-zinc-600">Opened</dt><dd className="min-w-0 break-words text-right text-zinc-300">{fullDate.format(new Date(trade.openedAt))}</dd></div>
              <div className="flex items-start justify-between gap-4"><dt className="shrink-0 text-zinc-600">Closed</dt><dd className="min-w-0 break-words text-right text-zinc-300">{fullDate.format(new Date(trade.closedAt))}</dd></div>
              <div className="flex items-start justify-between gap-4"><dt className="text-zinc-600">Duration</dt><dd className="text-zinc-300">{duration(trade.openedAt, trade.closedAt)}</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl border border-white/[0.09] bg-[#07090d] p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Risk methodology</p>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Performance is expressed in R, where 1R represents the predefined risk allocated to the completed trade. Initial risk is used only for this calculation and is not published. Quantity, account value and monetary P&amp;L are never displayed.
            </p>
          </div>
        </section>

        {!privateReview && <div className="mt-6"><JournalUpdatesPrompt placement="trade_detail" /></div>}
      </div>
    </main>
  );
}
