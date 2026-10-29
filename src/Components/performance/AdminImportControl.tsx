"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportSummary } from "@/lib/performance/breakout-store";

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
  function choose(value: File | null) {
    setFile(null); setError(""); setMessage(""); setSummary(null);
    if (!value) return;
    if (!value.name.toLowerCase().endsWith(".csv") || !value.size || value.size > 2_000_000) { setError("Choose a nonempty CSV smaller than 2 MB."); return; }
    setFile(value);
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true); setError(""); setMessage(""); setSummary(null);
    const form = new FormData(); form.set("file", file); form.set("accountId", "breakout-1");
    try {
      const response = await fetch("/api/performance/admin/imports", { method: "POST", credentials: "same-origin", body: form });
      const body = await response.json();
      if (!response.ok) { setError(body.error ?? "Upload rejected. No records were saved."); return; }
      setSummary(body.summary); setFile(null); if (input.current) input.current.value = "";
      setMessage("Import complete. Clean positions are ready for private review. Overlaps remain in Reconciliation. Nothing was published."); router.refresh();
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
    <p className="mt-3 text-xs leading-5 text-zinc-500">You can upload just your most recent trades. Already imported positions are skipped; new positions are added and earlier imports are kept. Incompatible or invalid files save nothing. Positions are never automatically grouped or matched to Bybit. Closed-position CSVs do not track active trades.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-[#ffad83]">{message}</p>}
    {summary && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-300"><span>{summary.newRows} new</span><span>{summary.duplicates} already imported</span><span>{summary.readyToReview} clean</span><span>{summary.needsReconciliation} need reconciliation</span><a href="/performance/review#trade-review" className="text-[#ffad83] underline">Review imported trades</a></div>}
    {account && !account.active && <div className="mt-4 rounded-lg border border-[#ff6719]/30 p-3"><p className="text-sm leading-6 text-zinc-300">Uploads are private. When ready, switch the public result source from {account.historyFrom.slice(0, 10)} UTC. Covered Bybit results remain in private history.</p><button type="button" onClick={activate} disabled={busy} className="mt-3 min-h-11 rounded-lg border border-[#ff6719]/40 px-4 text-sm text-[#ffad83] disabled:opacity-40">Use Breakout as result source</button></div>}
    {!!imports.length && <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-sm text-zinc-300">Import history ({imports.length} recent)</summary><ul className="mt-3 space-y-3">{imports.map(item => <li key={item.id} className="break-words text-xs leading-5 text-zinc-400"><span className="text-zinc-200">{item.filename}</span> · {timestamp(item.completedAt)} Sydney<br />{item.newRows} new · {item.duplicates} already imported · {item.needsReconciliation} need reconciliation</li>)}</ul></details>}
  </section>;
}
