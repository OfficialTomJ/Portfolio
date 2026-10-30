"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportSummary } from "@/lib/performance/breakout-store";
import type { ImportPreview } from "@/lib/performance/breakout-preview";
import ImportPreviewTable from "./ImportPreviewTable";

type Account = { historyFrom: string; historyThrough: string; lastImportedAt: string; importRevision: number; active: boolean };
const timestamp = (value: string) => new Date(value).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });
export default function AdminImportControl({ account, imports }: { account: Account | null; imports: ImportSummary[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [stale, setStale] = useState(false);
  function choose(value: File | null) {
    setFile(null); setError(""); setMessage(""); setSummary(null); setPreview(null); setSelected([]); setStale(false);
    if (!value) return;
    if (!value.name.toLowerCase().endsWith(".csv") || !value.size || value.size > 2_000_000) { setError("Choose a nonempty CSV smaller than 2 MB."); return; }
    setFile(value);
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true); setError(""); setMessage(""); setSummary(null); setPreview(null); setSelected([]); setStale(false);
    const form = new FormData(); form.set("file", file); form.set("accountId", "breakout-1");
    try {
      const response = await fetch("/api/performance/admin/imports/preview", { method: "POST", credentials: "same-origin", body: form });
      const body = await response.json();
      if (!response.ok) { setError(`${body.error ?? "CSV rejected."} Nothing was imported. Fix or re-export the file before retrying.`); return; }
      const next: ImportPreview = body.preview;
      setPreview(next); setSelected(next.rows.filter(row => row.status === "new").map(row => row.key));
      setMessage(next.clean || next.reconciliation ? "Preview ready. Nothing has been saved. Choose positions below, then confirm the import." : "All positions are already imported. Nothing new to import.");
    } catch { setError("Preview could not be loaded. Nothing was saved; try again."); }
    finally { setBusy(false); }
  }
  async function confirmImport() {
    if (!file || !preview || !selected.length || busy || stale) return;
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(); form.set("file", file); form.set("accountId", "breakout-1");
    form.set("fileSha256", preview.fileSha256); form.set("revision", String(preview.revision)); form.set("selectedKeys", JSON.stringify(selected));
    try {
      const response = await fetch("/api/performance/admin/imports", { method: "POST", credentials: "same-origin", body: form });
      const body = await response.json();
      if (!response.ok) { if (response.status === 409) setStale(true); setError(body.error ?? "Import was not confirmed. Preview the file again."); return; }
      setSummary(body.summary); setPreview(null); setSelected([]); setFile(null); if (input.current) input.current.value = "";
      setMessage("Import complete. Selected clean positions are ready for private review. Selected conflicts stay in Reconciliation. Nothing was published."); router.refresh();
    } catch { setError("Import could not be confirmed. Refresh import history, then retry the same file if needed."); }
    finally { setBusy(false); }
  }
  async function activate() {
    if (!account || busy || !window.confirm(`Use Breakout results from ${account.historyFrom.slice(0, 10)} UTC? Earlier Bybit results stay public. Covered Bybit results and notes stay in private history. Only explicitly published Breakout trades will appear publicly.`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/performance/admin/imports/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: account.importRevision }) });
      const body = await response.json();
      if (!response.ok) { setError(body.error ?? "Source switch was not confirmed."); return; }
      setMessage("Breakout is now the result source for this period. Earlier Bybit history is preserved. Publish reviewed Breakout positions individually."); router.refresh();
    } catch { setError("Source switch could not be confirmed. Refresh before retrying."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="csv-import-title" className="rounded-2xl border border-white/10 bg-[#07090d] p-4 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="csv-import-title" className="text-lg font-medium">Upload Breakout CSV</h2><p className="mt-1 text-xs leading-5 text-zinc-400">Breakout account 1 · Closed positions · Base 1R unchanged · Bybit account sync retired</p></div>{account && <p className="text-xs leading-5 text-zinc-500">Last imported {timestamp(account.lastImportedAt)} Sydney<br />History through {timestamp(account.historyThrough)} Sydney</p>}</header>
    <form onSubmit={upload} className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="min-w-0 flex-1 text-sm text-zinc-300">Closed-positions CSV<input ref={input} type="file" accept=".csv,text/csv" disabled={busy} onChange={event => void choose(event.target.files?.[0] ?? null)} className="mt-2 block w-full min-w-0 rounded-lg border border-white/15 p-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" /></label>
      <button type="submit" disabled={!file || busy} className="min-h-11 rounded-lg bg-[#ff6719] px-4 py-2 text-sm font-medium text-black disabled:opacity-40">{busy ? "Processing…" : "Upload and process"}</button>
    </form>
    <p className="mt-3 text-xs leading-5 text-zinc-500">Upload and process opens a preview; nothing is saved until you confirm your selection. Recent exports are supported and earlier imports are kept. Invalid CSVs are rejected in full. Positions are never automatically grouped or matched to Bybit.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-[#ffad83]">{message}</p>}
    {preview && <><ImportPreviewTable key={`${preview.fileSha256}:${preview.revision}`} preview={preview} selected={selected} busy={busy} onChange={setSelected} /><div className="mt-4 rounded-lg border border-white/10 p-3"><p className="text-xs leading-5 text-zinc-400">Only selected rows enter the journal. On confirmation, the full CSV is retained privately as source evidence, including unchecked rows, so later imports cannot hide conflicts. Unselected trades can be chosen in a future preview.</p><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={!selected.length || busy || stale} onClick={confirmImport} className="min-h-11 rounded-lg bg-[#ff6719] px-4 text-sm font-medium text-black disabled:opacity-40">{busy ? "Importing…" : `Import ${selected.length} selected`}</button><button type="button" disabled={busy} onClick={() => { setPreview(null); setSelected([]); setMessage("Preview cancelled. Nothing was imported."); }} className="min-h-11 px-3 text-sm text-zinc-400">Cancel preview</button><span className="text-xs text-zinc-400">{preview.rows.filter(row => selected.includes(row.key) && row.status === "reconciliation").length} selected for Reconciliation</span></div></div></>}
    {summary && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-300"><span>{summary.newRows} newly imported</span><span>{summary.duplicates} already imported</span><span>{summary.skippedRows ?? 0} left unchecked</span><span>{summary.readyToReview} clean</span><span>{summary.needsReconciliation} need reconciliation</span><a href="/performance/review#trade-review" className="text-[#ffad83] underline">Review imported trades</a></div>}
    {account && !account.active && <div className="mt-4 rounded-lg border border-[#ff6719]/30 p-3"><p className="text-sm leading-6 text-zinc-300">Uploads are private. When ready, switch the public result source from {account.historyFrom.slice(0, 10)} UTC. Covered Bybit results remain in private history.</p><button type="button" onClick={activate} disabled={busy || !!preview} className="mt-3 min-h-11 rounded-lg border border-[#ff6719]/40 px-4 text-sm text-[#ffad83] disabled:opacity-40">Use Breakout as result source</button></div>}
    {!!imports.length && <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-sm text-zinc-300">Import history ({imports.length} recent)</summary><ul className="mt-3 space-y-3">{imports.map(item => <li key={item.id} className="break-words text-xs leading-5 text-zinc-400"><span className="text-zinc-200">{item.filename}</span> · {timestamp(item.completedAt)} Sydney<br />{item.newRows} new · {item.duplicates} already imported · {item.needsReconciliation} need reconciliation</li>)}</ul></details>}
  </section>;
}
