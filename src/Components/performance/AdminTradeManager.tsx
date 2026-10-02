"use client";
import Link from "next/link";
import { useState } from "react";
import type { AdminActivePosition, AdminPendingReview } from "@/lib/performance/admin-selection";
import { asrStatus, type TradeAnnotation } from "@/lib/performance/annotations-model";
import { signedR } from "@/lib/performance/metrics";
import type { PerformanceTrade, TradeTag } from "@/lib/performance/types";
import AdminPublishButton from "./AdminPublishButton";
import TradeEditorButton from "./TradeEditor";

const date = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
export default function AdminTradeManager({ trades, pendingReviews, activePositions, annotations, tags, tagFilter }: {
  trades: PerformanceTrade[]; pendingReviews: AdminPendingReview[]; activePositions: AdminActivePosition[];
  annotations: Record<string, TradeAnnotation>; tags: TradeTag[]; tagFilter: string;
}) {
  const [tab, setTab] = useState<"pending" | "published" | "active">("pending");
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);
  const pendingById = new Map(pendingReviews.map((item) => [item.id, item.fingerprint]));
  const matchesSearch = (symbol: string) => symbol.toLowerCase().includes(search.trim().toLowerCase());
  const closedTrades = trades.filter((trade) => (tab === "pending" ? pendingById.has(trade.id) : !pendingById.has(trade.id)) && matchesSearch(trade.symbol) && (reviewFilter === "all" || asrStatus(annotations[trade.id]) === reviewFilter));
  const active = activePositions.filter((trade) => matchesSearch(trade.symbol) && (tagFilter === "all" || (tagFilter === "untagged" ? !annotations[trade.id]?.tagIds.length : annotations[trade.id]?.tagIds.includes(tagFilter))));
  const pendingCount = trades.filter((trade) => pendingById.has(trade.id)).length;
  return <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]">
    <header className="space-y-4 border-b border-white/10 p-4 sm:p-6">
      <div><h2 className="text-xl font-medium">Manage trades</h2><p className="mt-1 text-xs text-zinc-500">Closed trades follow the period and tag filters above. Active positions are separate from results.</p></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Trade status">{[{ value: "pending", label: `Pending (${pendingCount})` }, { value: "published", label: `Published (${trades.length - pendingCount})` }, { value: "active", label: `Active (${activePositions.length})` }].map((item) => <button key={item.value} type="button" aria-pressed={tab === item.value} onClick={() => setTab(item.value as typeof tab)} className={`rounded-lg border px-3 py-2.5 text-sm ${tab === item.value ? "border-[#ff6719]/35 bg-[#ff6719]/10 text-[#ffad83]" : "border-white/10 text-zinc-400"}`}>{item.label}</button>)}</div>
      <div className="flex flex-col gap-3 sm:flex-row"><input aria-label="Search trades" placeholder="Search asset…" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-black px-3 text-sm" />{tab !== "active" && <select aria-label="ASR review status" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)} className="h-10 rounded-lg border border-white/15 bg-black px-3 text-sm text-zinc-300"><option value="all">All review statuses</option><option>Not reviewed</option><option>Incomplete</option><option>Reviewed</option></select>}</div>
    </header>
    {notice && <p role="status" className="border-b border-white/10 p-4 text-sm text-[#ffad83]">{notice}</p>}
    {tab === "active" ? <div>{active.length ? active.map((trade) => <div key={trade.id} className="flex flex-col gap-3 border-b border-white/10 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="font-medium">{trade.symbol.replace("USDT", " / USDT")} <span className={`ml-2 text-xs ${trade.direction === "Long" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{trade.direction.toUpperCase()}</span></p><p className="mt-1 text-xs text-zinc-500">Opened {date.format(new Date(trade.openedAt))} GMT · Active</p><TagChips tags={tags.filter((tag) => annotations[trade.id]?.tagIds.includes(tag.id))} /></div><TradeEditorButton trade={trade} className="self-start" /></div>) : <Empty />}</div> : <div>{closedTrades.length ? closedTrades.map((trade) => <div key={trade.id} className="flex flex-col gap-3 border-b border-white/10 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><Link href={`/performance/review/trades/${trade.id}`} className="break-words font-medium hover:text-[#ff8b52]">{trade.symbol.replace("USDT", " / USDT")}</Link><span className={`ml-2 text-xs ${trade.direction === "Long" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{trade.direction.toUpperCase()}</span><p className="mt-1 text-xs leading-5 text-zinc-500">{date.format(new Date(trade.closedAt))} GMT · {asrStatus(annotations[trade.id])}</p><TagChips tags={trade.tags ?? []} /></div><div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end"><span className="text-lg font-medium tabular-nums text-[#ff8b52]">{signedR(trade.resultR)}</span><TradeEditorButton trade={trade} />{pendingById.has(trade.id) && <AdminPublishButton trade={trade} fingerprint={pendingById.get(trade.id)!} onMessage={setNotice} anotherPublicationInProgress={publishing !== null && publishing !== trade.id} onPublicationStateChange={setPublishing} />}</div></div>) : <Empty />}</div>}
  </section>;
}
function Empty() { return <p className="px-4 py-12 text-center text-sm text-zinc-500">No trades match this selection.</p>; }
function TagChips({ tags }: { tags: TradeTag[] }) { return tags.length ? <div className="mt-2 flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag.id} className="rounded border border-white/10 px-2 py-0.5 text-xs text-zinc-400">{tag.name}</span>)}</div> : null; }
