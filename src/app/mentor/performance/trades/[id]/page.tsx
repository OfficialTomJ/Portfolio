import Link from "next/link";
import { notFound } from "next/navigation";
import { FaArrowLeftLong } from "react-icons/fa6";
import AccessGate from "@/Components/AccessGate";
import TradePriceChart from "@/Components/performance/TradePriceChart";
import { getMemberSession } from "@/lib/session";
import { getMockTrade } from "@/lib/performance/mock";
import { getHistoricalCandles } from "@/lib/performance/market";
import { signedR } from "@/lib/performance/metrics";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const item = getMockTrade((await params).id);
  if (!item) return { title: "Trade not found, The Blueprint" };
  const title = `${item.symbol} ${item.direction} ${signedR(item.resultR)}, Performance Journal`;
  const description = `A retrospective chart of a completed ${item.symbol} trade, measured in R.`;
  return {
    title,
    description,
    openGraph: { title, description, images: [] },
    twitter: { card: "summary" as const, title, description, images: [] },
  };
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
      <p className={`mt-2 text-lg font-medium tabular-nums ${tone === "orange" ? "text-[var(--bp-accent)]" : "text-zinc-200"}`}>{value}</p>
    </div>
  );
}

export default async function TradePage({ params }: Props) {
  const isPreview = process.env.VERCEL_ENV === "preview";
  if (!isPreview && !(await getMemberSession())) return <AccessGate />;
  const trade = getMockTrade((await params).id);
  if (!trade) notFound();
  const candles = await getHistoricalCandles(trade);

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-24">
      <div className="mx-auto max-w-7xl px-4 pt-7 sm:px-6 sm:pt-10">
        <Link href="/performance" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white">
          <FaArrowLeftLong className="text-xs" /> Performance journal
        </Link>

        <header className="mt-7 flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-[#ff6719]/20 bg-[#ff6719]/[0.07] px-2.5 py-1 font-medium uppercase tracking-[0.14em] text-[#ff8b52]">Mock trade</span>
              <span className="text-zinc-600">Closed · Binance market data</span>
            </div>
            <h1 className="mt-4 text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
              {trade.symbol.replace("USDT", " / USDT")}
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              {trade.direction} · {duration(trade.openedAt, trade.closedAt)} · Closed {fullDate.format(new Date(trade.closedAt))}
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
              <h2 className="mt-1 text-lg font-medium">Entry to exit</h2>
            </div>
            <p className="text-xs text-zinc-600">Public asset prices · no position sizing</p>
          </div>
          <div className="p-2 sm:p-4">
            {candles.length ? (
              <TradePriceChart trade={trade} candles={candles} />
            ) : (
              <div className="grid h-[360px] place-items-center text-sm text-zinc-600 sm:h-[500px]">
                Market chart unavailable
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 border-t border-white/[0.08] sm:grid-cols-4">
            <Detail label="Entry" value={price(trade.entryPrice)} />
            <Detail label="Exit" value={price(trade.exitPrice)} />
            <Detail label="Max favourable" value={signedR(trade.mfeR)} tone="orange" />
            <Detail label="Max adverse" value={signedR(trade.maeR)} />
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.09] bg-[#07090d] p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Position timeline</p>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4"><dt className="text-zinc-600">Opened</dt><dd className="text-right text-zinc-300">{fullDate.format(new Date(trade.openedAt))}</dd></div>
              <div className="flex items-start justify-between gap-4"><dt className="text-zinc-600">Closed</dt><dd className="text-right text-zinc-300">{fullDate.format(new Date(trade.closedAt))}</dd></div>
              <div className="flex items-start justify-between gap-4"><dt className="text-zinc-600">Duration</dt><dd className="text-zinc-300">{duration(trade.openedAt, trade.closedAt)}</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl border border-white/[0.09] bg-[#07090d] p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Risk methodology</p>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Performance is expressed in R, where 1R represents the predefined risk allocated to the completed trade. Asset prices are public market data; quantity, account value and monetary P&amp;L are never displayed.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
