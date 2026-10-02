"use client";
import { asrStatus, type TradeAnnotation } from "@/lib/performance/annotations-model";
import type { PerformanceTrade, TradeTag } from "@/lib/performance/types";
import { signedR } from "@/lib/performance/metrics";
import TradeEditorButton from "./TradeEditor";

export default function AdminTradeReview({ trade, annotation, tags }: { trade: PerformanceTrade; annotation: TradeAnnotation; tags: TradeTag[] }) {
  return <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]">
    <header className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-[11px] uppercase tracking-[0.16em] text-[#ff8b52]">Private · Advanced Self Review</p><h2 className="mt-1 text-xl font-medium">{asrStatus(annotation)}</h2></div><TradeEditorButton trade={trade} initialAnnotation={annotation} initialTags={tags} className="self-start" /></header>
    <div className="grid grid-cols-2 divide-x divide-y divide-white/10 sm:grid-cols-4 sm:divide-y-0">{[
      { label: "Actual R", value: signedR(trade.resultR) },
      { label: "Expected R", value: annotation.expectedR == null ? "Not set" : signedR(annotation.expectedR) },
      { label: "Management gap", value: annotation.expectedR == null ? "Not set" : signedR(annotation.expectedR - trade.resultR) },
      { label: "Validity", value: annotation.valid === null ? "Not reviewed" : annotation.valid ? "Valid" : "Invalid" },
    ].map((item) => <div key={item.label} className="min-w-0 p-4 sm:p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500">{item.label}</p><p className="mt-2 break-words text-lg font-medium">{item.value}</p></div>)}</div>
    <div className="grid gap-5 border-t border-white/10 p-5 sm:grid-cols-2 sm:p-6"><div><h3 className="text-sm font-medium">Private notes</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">{annotation.privateNotes || "No private notes yet."}</p></div><div><h3 className="text-sm font-medium">ASR comments</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">{annotation.asrComments || "No review comments yet."}</p></div></div>
  </section>;
}
