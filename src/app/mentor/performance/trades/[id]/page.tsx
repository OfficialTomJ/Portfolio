import Link from "next/link";
import { notFound } from "next/navigation";
import { FaArrowLeftLong } from "react-icons/fa6";
import PerformanceUnavailable from "@/Components/performance/PerformanceUnavailable";
import TradePriceChart from "@/Components/performance/TradePriceChart";
import { getLivePerformanceTrade } from "@/lib/performance/data";
import { getHistoricalCandles } from "@/lib/performance/market";
import { signedR } from "@/lib/performance/metrics";
import { tradeOpenGraphAlt } from "@/lib/performance/og";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const result = await getLivePerformanceTrade((await params).id);
  if (result.status !== "available") return { title: "Trade unavailable, The Blueprint" };
  const item = result.trade;
  const displaySymbol = item.symbol.replace("USDT", " / USDT");
  const title = `${displaySymbol} ${item.direction}: ${signedR(item.resultR)} | Performance Journal`;
  const description = `Review a completed ${displaySymbol} ${item.direction.toLowerCase()} from ${metadataDate.format(new Date(item.openedAt))} to ${metadataDate.format(new Date(item.closedAt))}, with its entry-to-exit price chart and recorded ${signedR(item.resultR)} result.`;
  const id = (await params).id;
  const canonical = `https://mentor.thomas-johnston.com/performance/trades/${encodeURIComponent(id)}`;
  const image = `${imageOrigin()}/api/performance/trades/${encodeURIComponent(id)}/og`;
  const images = [{ url: image, width: 1200, height: 630, alt: tradeOpenGraphAlt(item) }];
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "article" as const, url: canonical, title, description, images },
    twitter: { card: "summary_large_image" as const, title, description, images },
  };
}

const metadataDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function imageOrigin(): string {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.VERCEL_ENV === "production") {
    return "https://mentor.thomas-johnston.com";
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to the deployment URL.
    }
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

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

function Detail({ label, value, tone }: { label: string; value: string; tone?: "orange" }) {
  return (
    <div className="border-r border-white/[0.07] px-4 py-4 last:border-0 sm:px-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className={`mt-2 break-words text-lg font-medium leading-tight tabular-nums ${tone === "orange" ? "text-[var(--bp-accent)]" : "text-zinc-200"}`}>{value}</p>
    </div>
  );
}

export default async function TradePage({ params }: Props) {
  const result = await getLivePerformanceTrade((await params).id);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") {
    return (
      <main className="min-h-[calc(100vh-4rem)] pb-24">
        <div className="mx-auto max-w-7xl px-4 pt-7 sm:px-6 sm:pt-10">
          <Link href="/performance" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white">
            <FaArrowLeftLong className="text-xs" /> Performance journal
          </Link>
          <div className="mt-7">
            <PerformanceUnavailable title="This trade is temporarily unavailable." />
          </div>
        </div>
      </main>
    );
  }
  const trade = result.trade;
  const candles = await getHistoricalCandles(trade, "4h", 24);

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-24">
      <div className="mx-auto max-w-7xl px-4 pt-7 sm:px-6 sm:pt-10">
        <Link href="/performance" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white">
          <FaArrowLeftLong className="text-xs" /> Performance journal
        </Link>

        <header className="mt-7 flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-[#ff6719]/20 bg-[#ff6719]/[0.07] px-2.5 py-1 font-medium uppercase tracking-[0.14em] text-[#ff8b52]">Verified result</span>
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
            <p className="text-xs text-zinc-600">Public asset prices · drag or scroll to explore history</p>
          </div>
          <div className="p-2 sm:p-4">
            {candles.length ? (
              <TradePriceChart trade={trade} candles={candles} initialInterval="4h" />
            ) : (
              <div className="grid h-[360px] place-items-center text-sm text-zinc-600 sm:h-[500px]">
                Market chart unavailable
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 border-t border-white/[0.08]">
            <Detail label="Entry" value={price(trade.entryPrice)} />
            <Detail label="Exit" value={price(trade.exitPrice)} />
          </div>
        </section>

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
      </div>
    </main>
  );
}
