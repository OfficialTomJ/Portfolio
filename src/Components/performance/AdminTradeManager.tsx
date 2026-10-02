"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminActivePosition, AdminPendingReview, AdminReconciliationItem } from "@/lib/performance/admin-selection";
import { asrStatus, matchesTradeFilters, type TradeTypeFilter, type TradeAnnotation } from "@/lib/performance/annotations-model";
import { filterReviewTrades, type ReviewTab, type PublicationFilter } from "@/lib/performance/review-workspace";
import { signedR } from "@/lib/performance/metrics";
import type { PerformanceTrade, TradeTag } from "@/lib/performance/types";
import AdminPublishButton from "./AdminPublishButton";
import TradeEditorButton from "./TradeEditor";

const date = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const timestamp = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
// Fixed actions track prevents pending rows from shifting the shared result columns.
const rowColumns = "lg:grid-cols-[minmax(0,1fr)_minmax(15rem,1.1fr)_15rem]";
export default function AdminTradeManager({ trades, pendingReviews, activePositions, reconciliation = [], annotations, tags, typeFilters, strategyFilters }: {
  trades: PerformanceTrade[]; pendingReviews: AdminPendingReview[]; activePositions: AdminActivePosition[];
  annotations: Record<string, TradeAnnotation>; tags: TradeTag[]; typeFilters: TradeTypeFilter[]; strategyFilters: string[];
  reconciliation?: AdminReconciliationItem[];
}) {
  const [tab, setTab] = useState<ReviewTab>("needs_asr");
  const [search, setSearch] = useState("");
  const [publication, setPublication] = useState<PublicationFilter>("all");
  const [notice, setNotice] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);
  const pendingById = new Map(pendingReviews.map(item => [item.id, item.fingerprint]));
  const pendingIds = new Set(pendingById.keys());
  const closedTrades = filterReviewTrades(trades, annotations, pendingIds, tab, publication, search);
  const active = activePositions.filter(trade => trade.symbol.toLowerCase().includes(search.trim().toLowerCase()) && matchesTradeFilters(annotations[trade.id]?.tradeType, annotations[trade.id]?.strategyIds ?? [], typeFilters, strategyFilters));
  const held = reconciliation.filter(trade => trade.symbol.toLowerCase().includes(search.trim().toLowerCase()));
  const needs = filterReviewTrades(trades, annotations, pendingIds, "needs_asr", publication).length;
  const reviewed = filterReviewTrades(trades, annotations, pendingIds, "reviewed", publication).length;
  const all = filterReviewTrades(trades, annotations, pendingIds, "all", publication).length;
  return <section aria-label="Trade review queue" className="overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]">
    <header className="space-y-4 border-b border-white/10 p-4 sm:p-5">
      <div><h2 className="text-lg font-medium">Review trades</h2><p className="mt-1 text-xs leading-5 text-zinc-500">{tab === "reconciliation" ? "Read-only · All history, regardless of filters above. Excluded from results until reconciled." : "Closed trades follow the filters above. Publication and ASR are separate."}</p></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Review status">{[{ id: "needs_asr", name: `Needs ASR (${needs})` }, { id: "reviewed", name: `Reviewed (${reviewed})` }, { id: "all", name: `All closed (${all})` }, { id: "active", name: `Active (${active.length})` }, { id: "reconciliation", name: `Reconciliation (${reconciliation.length})` }].map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id as ReviewTab)} className={`min-h-10 rounded-lg border px-3 py-2 text-sm ${tab === item.id ? "border-[#ff6719]/35 bg-[#ff6719]/10 text-[#ffad83]" : "border-white/10 text-zinc-400"}`}>{item.name}</button>)}</div>
      <div className="flex flex-col gap-3 sm:flex-row"><input aria-label="Search trades" placeholder="Search asset…" value={search} onChange={event => setSearch(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-black px-3 text-sm" />{tab !== "active" && tab !== "reconciliation" && <select aria-label="Publication status" value={publication} onChange={event => setPublication(event.target.value as PublicationFilter)} className="h-10 min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-zinc-300 sm:w-48"><option value="all">All publication statuses</option><option value="pending">Unpublished</option><option value="published">Published</option></select>}</div>
    </header>
    {notice && <p role="status" className="border-b border-white/10 p-4 text-sm text-[#ffad83]">{notice}</p>}
    {tab !== "active" && closedTrades.length > 0 && <div aria-hidden="true" className={`hidden gap-4 border-b border-white/10 px-5 py-3 text-xs text-zinc-500 lg:grid ${rowColumns}`}><span>Trade</span><div className="grid grid-cols-3 gap-3 text-right"><span>Actual R</span><span>Expected R</span><span>Gap</span></div><span className="text-right">Actions</span></div>}
    {tab === "reconciliation" ? <div>{held.length ? held.map(trade => <article key={trade.id} data-reconciliation-id={trade.id} className="grid min-w-0 gap-3 border-b border-white/10 p-4 last:border-0 sm:grid-cols-2 sm:p-5">
      <div className="min-w-0"><TradeName symbol={trade.symbol} direction={trade.direction} /><p className="mt-1 break-words text-xs leading-5 text-zinc-500">Opened {timestamp.format(new Date(trade.openedAt))} GMT</p><p className="break-words text-xs leading-5 text-zinc-500">{trade.closedAt ? `Closed ${timestamp.format(new Date(trade.closedAt))} GMT` : "Close not yet confirmed"}</p></div>
      <div className="min-w-0"><p className="break-words text-sm text-[#ffad83]">{trade.reason}</p><p className="mt-1 break-words text-xs leading-5 text-zinc-500">Recorded {timestamp.format(new Date(trade.lastSeenAt))} GMT</p><p className="mt-1 text-xs text-zinc-600">Read-only · Not included in results</p></div>
    </article>) : <p className="px-4 py-12 text-center text-sm text-zinc-500">{reconciliation.length ? "No reconciliation records match this search." : "No trades need reconciliation."}</p>}</div> : tab === "active" ? <div>{active.length ? active.map(trade => <div key={trade.id} data-trade-id={trade.id} className="flex flex-col gap-3 border-b border-white/10 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0"><TradeName symbol={trade.symbol} direction={trade.direction} /><p className="mt-1 text-xs text-zinc-500">Opened {date.format(new Date(trade.openedAt))} GMT · Active, excluded from results</p><Classification annotation={annotations[trade.id]} tags={tags} /></div><TradeEditorButton trade={trade} initialAnnotation={annotations[trade.id]} initialTags={tags} className="self-start" /></div>) : <Empty active />}</div> : <div>{closedTrades.length ? closedTrades.map(trade => {
      const annotation = annotations[trade.id];
      const expected = annotation?.expectedR;
      const status = asrStatus(annotation);
      const publication = pendingIds.has(trade.id) ? { status: "unpublished" as const, trade, fingerprint: pendingById.get(trade.id)! } : { status: "published" as const, trade };
      return <div key={trade.id} data-trade-id={trade.id} className={`grid items-start gap-4 border-b border-white/10 p-4 last:border-0 sm:p-5 ${rowColumns}`}>
        <div className="min-w-0"><Link href={`/performance/review/trades/${trade.id}`} className="block hover:text-[#ff8b52]"><TradeName symbol={trade.symbol} direction={trade.direction} /></Link><p className="mt-1 text-xs text-zinc-500">{date.format(new Date(trade.closedAt))} GMT</p><Classification annotation={annotation} tags={tags} /><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded border border-white/10 px-2 py-1 text-zinc-300">ASR: {status === "Not reviewed" ? "Needs review" : status}</span><span className="rounded border border-white/10 px-2 py-1 text-zinc-500">{pendingIds.has(trade.id) ? "Unpublished" : "Published"}</span></div></div>
        <div className="min-w-0 lg:text-right"><dl className="grid grid-cols-3 gap-3"><Result label="Actual R" value={signedR(trade.resultR)} actual /><Result label="Expected R" value={expected == null ? "Not reviewed" : signedR(expected)} /><Result label="Gap" value={expected == null ? "Not reviewed" : signedR(expected - trade.resultR)} /></dl><p className="mt-2 text-xs text-zinc-500">Validity: {annotation?.valid == null ? "Not reviewed" : annotation.valid ? "Valid" : "Invalid"}</p></div>
        <div className="grid grid-cols-2 gap-2"><TradeEditorButton trade={trade} initialAnnotation={annotation} initialTags={tags} initialPublication={publication} /><Link href={`/performance/review/trades/${trade.id}`} className="min-h-11 rounded-lg border border-[#ff6719]/30 px-3 py-2.5 text-center text-sm text-[#ffad83]">Review</Link>{publication.status === "unpublished" ? <AdminPublishButton trade={trade} fingerprint={publication.fingerprint} tradeType={annotation?.tradeType} description={annotation?.description} className="col-span-2" onMessage={setNotice} anotherPublicationInProgress={publishing !== null && publishing !== trade.id} onPublicationStateChange={setPublishing} /> : <span className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 text-sm text-zinc-500">Published</span>}</div>
      </div>;
    }) : <Empty />}</div>}
  </section>;
}
function TradeName({ symbol, direction }: { symbol: string; direction: string }) { return <p className="break-words font-medium">{symbol.replace("USDT", " / USDT")} <span className={`ml-2 text-xs ${direction === "Long" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{direction.toUpperCase()}</span></p>; }
function Classification({ annotation, tags }: { annotation?: TradeAnnotation; tags: TradeTag[] }) { return <div className="mt-2 flex flex-wrap gap-1.5">{annotation?.tradeType && <span className="rounded border border-white/15 px-2 py-0.5 text-xs text-zinc-300">{annotation.tradeType}</span>}{tags.filter(tag => annotation?.strategyIds.includes(tag.id)).map(tag => <span key={tag.id} className="max-w-full break-words rounded border border-white/10 px-2 py-0.5 text-xs text-zinc-500">{tag.name}</span>)}</div>; }
function Result({ label, value, actual }: { label: string; value: string; actual?: boolean }) { return <div className="min-w-0" data-result-column={label}><dt className="text-xs text-zinc-500 lg:sr-only">{label}</dt><dd className={`mt-1.5 min-h-7 break-words font-medium tabular-nums lg:mt-0 ${value === "Not reviewed" ? "text-xs text-zinc-600" : actual ? "text-lg text-[#ff8b52]" : "text-lg text-zinc-200"}`}>{value}</dd></div>; }
function Empty({ active = false }: { active?: boolean }) { return <p className="px-4 py-12 text-center text-sm text-zinc-500">{active ? "No active positions match these filters." : "No closed trades match this review selection."}</p>; }
