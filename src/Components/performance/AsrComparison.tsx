"use client";
import { useMemo, useState } from "react";
import { buildAsrComparison, type TradeAnnotation } from "@/lib/performance/annotations-model";
import { signedR } from "@/lib/performance/metrics";
import type { PerformanceView } from "@/lib/performance/types";
import PerformanceEquityChart from "./PerformanceEquityChart";

export default function AsrComparison({ view, annotations }: { view: PerformanceView; annotations: Record<string, TradeAnnotation> }) {
  const [validity, setValidity] = useState<"all" | "valid" | "invalid">("all");
  const [mode, setMode] = useState<"asr" | "actual">("actual");
  const result = useMemo(() => buildAsrComparison(view.trades, annotations, view.startsAt, validity), [view, annotations, validity]);
  return <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]">
    <header className="flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div><p className="text-[11px] uppercase tracking-[0.16em] text-[#ff8b52]">Private · Advanced Self Review</p><h2 className="mt-1 text-xl font-medium">{mode === "asr" ? "Actual vs expected" : "Actual performance"}</h2><p className="mt-2 text-xs leading-5 text-zinc-500">{result.reviewedCount} of {result.eligibleCount} closed trades reviewed · {result.validCount} valid · {result.invalidCount} invalid{result.incompleteCount ? ` · ${result.incompleteCount} incomplete` : ""}</p></div>
      {mode === "asr" && <label className="text-xs text-zinc-500">Trade validity<select aria-label="ASR trade validity" value={validity} onChange={(event) => setValidity(event.target.value as typeof validity)} className="mt-1.5 block h-10 w-full rounded-lg border border-white/15 bg-black px-3 text-sm text-zinc-200 sm:w-44"><option value="all">All reviewed</option><option value="valid">Valid only</option><option value="invalid">Invalid only</option></select></label>}
    </header>
    <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3 sm:px-6">{[{ value: "actual", label: "All actual results" }, { value: "asr", label: "ASR comparison" }].map((item) => <button key={item.value} type="button" aria-pressed={mode === item.value} onClick={() => setMode(item.value as typeof mode)} className={`rounded-lg border px-3 py-2 text-xs ${mode === item.value ? "border-[#ff6719]/40 text-[#ffad83]" : "border-white/10 text-zinc-500"}`}>{item.label}</button>)}</div>
    {mode === "asr" && <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
      {[{ label: "Actual R", value: result.actualR }, { label: "Expected R", value: result.expectedR }, { label: "Management gap", value: result.gap }].map((item) => <div key={item.label} className="min-w-0 p-3 sm:p-5"><p className="text-[10px] uppercase leading-4 tracking-wider text-zinc-500">{item.label}</p><p className="mt-2 break-words text-xl font-medium tabular-nums sm:text-2xl">{result.pairedCount ? signedR(item.value) : "N/A"}</p></div>)}
    </div>}
    <div className="p-4 sm:p-6">{mode === "actual" ? <PerformanceEquityChart points={view.equity} /> : result.pairedCount ? <PerformanceEquityChart points={result.actual} comparisonPoints={result.expected} /> : <div className="grid h-32 place-items-center text-center"><div><p className="text-sm text-zinc-300">No completed ASRs in this selection.</p><p className="mt-2 text-xs text-zinc-500">Add expected R and validity in Edit trade.</p></div></div>}
      <p className="mt-3 text-xs leading-5 text-zinc-500">{mode === "actual" ? `Actual results for all ${view.trades.length} closed trades in this selection, including pending review.` : `Both curves use the same ${result.pairedCount} reviewed trade${result.pairedCount === 1 ? "" : "s"}. Expected R is your manual assessment. Gap = expected minus actual.`}</p>
    </div>
  </section>;
}
