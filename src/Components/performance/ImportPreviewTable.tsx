"use client";
import { useEffect, useRef, useState } from "react";
import type { ImportPreview, ImportRowStatus } from "@/lib/performance/breakout-preview";

const date = (value: string) => new Date(value).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "short", timeStyle: "short" });
const price = (value: number) => value.toLocaleString("en-AU", { maximumFractionDigits: 8 });
export default function ImportPreviewTable({ preview, selected, busy, onChange }: {
  preview: ImportPreview; selected: string[]; busy: boolean; onChange: (keys: string[]) => void;
}) {
  const [filter, setFilter] = useState<ImportRowStatus | "all">("all");
  const [page, setPage] = useState(0);
  const all = useRef<HTMLInputElement>(null);
  const selection = new Set(selected);
  const clean = preview.rows.filter(row => row.status === "new");
  const checked = clean.filter(row => selection.has(row.key)).length;
  useEffect(() => { if (all.current) all.current.indeterminate = checked > 0 && checked < clean.length; }, [checked, clean.length]);
  const rows = preview.rows.filter(row => filter === "all" || row.status === filter);
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const current = Math.min(page, pages - 1);
  function toggle(key: string) { onChange(selection.has(key) ? selected.filter(value => value !== key) : [...selected, key]); }
  function toggleClean() {
    const keys = new Set(clean.map(row => row.key));
    onChange(checked === clean.length ? selected.filter(key => !keys.has(key)) : [...new Set([...selected, ...keys])]);
  }
  return <div className="mt-5 min-w-0 space-y-3" aria-label="CSV trade selection">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-medium text-white">Choose trades to import</h3><p className="mt-1 text-xs leading-5 text-zinc-400">{preview.rows.length} positions · {preview.clean} new and clean · {preview.reconciliation} need reconciliation · {preview.duplicates} already imported</p></div>
      <label className="text-xs text-zinc-400">Show<select aria-label="Filter preview trades" value={filter} disabled={busy} onChange={event => { setFilter(event.target.value as typeof filter); setPage(0); }} className="ml-2 rounded-lg border border-white/15 bg-black p-2 text-sm text-zinc-200"><option value="all">All positions</option><option value="new">New and clean</option><option value="reconciliation">Needs reconciliation</option><option value="duplicate">Already imported</option></select></label>
    </div>
    <p className="text-xs leading-5 text-zinc-400">Clean trades start selected. Reconciliation trades are optional and stay held outside results and publication. Already imported rows are locked. Unchecking a conflicting row does not clear another row&apos;s hold.</p>
    <p className="text-xs text-zinc-500 md:hidden">Scroll the table sideways for prices, net R and full status details.</p>
    {!!preview.affectedPending && <p className="rounded-lg border border-amber-400/30 p-3 text-sm text-amber-200">This file also reveals conflicts affecting {preview.affectedPending} previously clean pending position(s). Confirming an import will move those positions to Reconciliation.</p>}
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-white/10" tabIndex={0} role="region" aria-label="CSV positions preview">
      <table className="w-full min-w-[1000px] text-left text-xs">
        <caption className="sr-only">CSV positions, Sydney times. Select rows before importing.</caption>
        <thead className="sticky top-0 bg-[#12151b] text-zinc-300"><tr><th scope="col" className="p-3"><input ref={all} type="checkbox" aria-label="Select all clean trades" title="Select or clear all clean trades" checked={!!clean.length && checked === clean.length} disabled={busy || !clean.length} onChange={toggleClean} className="h-4 w-4 accent-[#ff6719]" /></th><th scope="col" className="p-3">Position</th><th scope="col" className="p-3">Opened (Sydney)</th><th scope="col" className="p-3">Closed (Sydney)</th><th scope="col" className="p-3">Entry → exit</th><th scope="col" className="p-3">Net R</th><th scope="col" className="p-3">Import status</th></tr></thead>
        <tbody>{rows.slice(current * 50, current * 50 + 50).map(row => <tr key={row.key} className={`border-t border-white/[0.06] ${selection.has(row.key) ? "bg-[#ff6719]/[0.04]" : ""}`}>
          <td className="p-3 align-top"><input type="checkbox" aria-label={`Import ${row.instrument} ${row.trade.direction}, CSV line ${row.line}`} checked={selection.has(row.key)} disabled={busy || row.status === "duplicate"} onChange={() => toggle(row.key)} className="h-4 w-4 accent-[#ff6719] disabled:opacity-30" /></td>
          <th scope="row" className="p-3 align-top font-normal"><span className="font-medium text-zinc-100">{row.instrument}</span><br /><span className="text-zinc-400">{row.trade.direction} · CSV line {row.line}</span><span className={`mt-1 block sm:hidden ${row.status === "reconciliation" ? "text-amber-200" : row.status === "duplicate" ? "text-zinc-400" : "text-emerald-300"}`}>{row.status === "new" ? "New · clean" : row.status === "duplicate" ? "Already imported" : "Needs reconciliation"}</span></th>
          <td className="whitespace-nowrap p-3 align-top text-zinc-300">{date(row.trade.openedAt)}</td><td className="whitespace-nowrap p-3 align-top text-zinc-300">{date(row.trade.closedAt)}</td>
          <td className="p-3 align-top text-zinc-300">{price(row.trade.entryPrice)} → {price(row.trade.exitPrice)}</td>
          <td className="whitespace-nowrap p-3 align-top text-zinc-200">{row.trade.resultR > 0 ? "+" : ""}{row.trade.resultR.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}R</td>
          <td className="max-w-xs p-3 align-top"><span className={row.status === "reconciliation" ? "text-amber-200" : row.status === "duplicate" ? "text-zinc-400" : "text-emerald-300"}>{row.status === "new" ? "New · clean" : row.status === "duplicate" ? "Already imported" : "Needs reconciliation"}</span><p className="mt-1 leading-5 text-zinc-500">{row.reason}</p></td>
        </tr>)}{!rows.length && <tr><td colSpan={7} className="p-6 text-zinc-400">No positions in this category.</td></tr>}</tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400"><button type="button" disabled={busy || !selected.length} onClick={() => onChange([])} className="min-h-10 underline underline-offset-4 disabled:opacity-40">Clear selection</button><span>{selected.length} selected</span>{pages > 1 && <div className="flex items-center gap-3"><button type="button" disabled={busy || current === 0} onClick={() => setPage(current - 1)} className="min-h-10 disabled:opacity-40">Previous</button><span>Page {current + 1} of {pages}</span><button type="button" disabled={busy || current === pages - 1} onClick={() => setPage(current + 1)} className="min-h-10 disabled:opacity-40">Next</button></div>}</div>
  </div>;
}
