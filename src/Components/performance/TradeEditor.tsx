"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EMPTY_ANNOTATION, type TradeAnnotation } from "@/lib/performance/annotations-model";
import type { TradeTag, TradeDirection } from "@/lib/performance/types";
import { signedR } from "@/lib/performance/metrics";

export interface EditableTradeSummary { id: string; symbol: string; direction: TradeDirection; resultR?: number }
const field = "mt-2 w-full rounded-lg border border-white/15 bg-black px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#ff6719]/70";

export default function TradeEditorButton({ trade, className = "" }: { trade: EditableTradeSummary; className?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className={`rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 transition hover:border-[#ff6719]/50 hover:text-white ${className}`} aria-label={`Edit ${trade.symbol} trade`}>Edit trade</button>
    {open && <TradeEditor trade={trade} onClose={() => setOpen(false)} />}
  </>;
}

function TradeEditor({ trade, onClose }: { trade: EditableTradeSummary; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [annotation, setAnnotation] = useState<TradeAnnotation>({ ...EMPTY_ANNOTATION });
  const [original, setOriginal] = useState("");
  const [expected, setExpected] = useState("");
  const [tags, setTags] = useState<TradeTag[]>([]);
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const payload = { ...annotation, expectedR: expected.trim() === "" ? null : Number(expected) };
  const dirty = !loading && JSON.stringify(payload) !== original;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controller = new AbortController();
    fetch(`/api/performance/admin/trades/${trade.id}/metadata`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not load editor"); return body; })
      .then((body) => { setAnnotation(body.annotation); setExpected(body.annotation.expectedR == null ? "" : String(body.annotation.expectedR)); setOriginal(JSON.stringify(body.annotation)); setTags(body.tags); setClosed(body.closed); setLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") setError("Could not load this trade. Close and try again."); });
    return () => { controller.abort(); document.body.style.overflow = overflow; element?.close(); };
  }, [trade.id]);

  const close = () => { if (!saving && !creating && (!dirty || window.confirm("Discard your unsaved changes?"))) onClose(); };
  const update = (key: "description" | "privateNotes" | "asrComments", value: string) => setAnnotation((previous) => ({ ...previous, [key]: value }));
  const toggleTag = (id: string) => setAnnotation((previous) => ({ ...previous, tagIds: previous.tagIds.includes(id) ? previous.tagIds.filter((tag) => tag !== id) : [...previous.tagIds, id].sort() }));
  async function createTag() {
    if (!query.trim() || creating) return;
    setCreating(true); setError("");
    try {
      const response = await fetch("/api/performance/admin/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: query }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setTags((previous) => [...previous.filter((tag) => tag.id !== result.tag.id), result.tag].sort((a, b) => a.name.localeCompare(b.name)));
      setAnnotation((previous) => ({ ...previous, tagIds: [...new Set([...previous.tagIds, result.tag.id])].sort() })); setQuery("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create tag"); }
    finally { setCreating(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving || loading || creating) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/performance/admin/trades/${trade.id}/metadata`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not save changes");
      router.refresh(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save changes"); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} aria-labelledby={`edit-title-${trade.id}`} onCancel={(event) => { event.preventDefault(); close(); }} className="m-auto h-dvh max-h-none w-full max-w-none border border-white/15 bg-[#07090d] p-0 text-zinc-100 backdrop:bg-black/80 sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl">
    <form onSubmit={save} className="flex h-full max-h-[100dvh] flex-col sm:max-h-[90dvh]">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-6">
        <div><p className="text-xs font-medium text-[#ff8b52]">Edit trade</p><h2 id={`edit-title-${trade.id}`} className="mt-1 text-xl font-medium">{trade.symbol.replace("USDT", " / USDT")} <span className="text-sm text-zinc-400">{trade.direction}</span></h2><p className="mt-1 text-xs text-zinc-500">{trade.resultR === undefined ? "Active position" : `Actual result ${signedR(trade.resultR)}`}</p></div>
        <button type="button" onClick={close} aria-label="Close editor" className="size-10 rounded-lg border border-white/10 text-xl text-zinc-400">×</button>
      </header>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {loading ? <p className="py-8 text-sm text-zinc-400">{error || "Loading trade…"}</p> : <>
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Public information</h3>
            <div><label htmlFor="tag-query" className="text-sm text-zinc-300">Tags</label>
              <div className="mt-2 flex flex-wrap gap-2">{annotation.tagIds.map((id) => <button key={id} type="button" onClick={() => toggleTag(id)} className="rounded-full border border-[#ff6719]/30 bg-[#ff6719]/10 px-3 py-1.5 text-xs text-[#ffad83]" aria-label={`Remove ${tags.find((tag) => tag.id === id)?.name} tag`}>{tags.find((tag) => tag.id === id)?.name} ×</button>)}</div>
              <input id="tag-query" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={40} placeholder="Find or create a tag" className={field} />
              <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{tags.filter((tag) => tag.name.toLowerCase().includes(query.trim().toLowerCase())).map((tag) => <button key={tag.id} type="button" aria-pressed={annotation.tagIds.includes(tag.id)} onClick={() => toggleTag(tag.id)} disabled={!annotation.tagIds.includes(tag.id) && annotation.tagIds.length >= 12} className={`rounded-lg border px-3 py-2 text-xs ${annotation.tagIds.includes(tag.id) ? "border-[#ff6719]/40 text-[#ffad83]" : "border-white/10 text-zinc-400"}`}>{annotation.tagIds.includes(tag.id) ? "✓ " : "+ "}{tag.name}</button>)}</div>
              {query.trim() && !tags.some((tag) => tag.name.toLowerCase() === query.trim().toLowerCase()) && <button type="button" onClick={createTag} disabled={creating || annotation.tagIds.length >= 12} className="mt-3 text-sm text-[#ff8b52]">{creating ? "Creating…" : `Create “${query.trim()}”`}</button>}
              {!tags.length && !query && <p className="mt-2 text-xs text-zinc-500">Create your first tag, such as Day or Swing.</p>}
            </div>
            <label className="block text-sm text-zinc-300">Description<textarea aria-label="Description" rows={3} value={annotation.description} onChange={(event) => update("description", event.target.value)} maxLength={5000} placeholder="Your public write-up for this trade" className={field} /><span className="mt-1 block text-xs text-zinc-500">Visible on the trade page once published.</span></label>
          </section>
          <section className="space-y-4 border-t border-white/10 pt-5">
            <h3 className="text-sm font-medium">Private review <span className="ml-2 text-xs font-normal text-zinc-500">Only you</span></h3>
            <label className="block text-sm text-zinc-300">Private notes<textarea aria-label="Private notes" rows={3} value={annotation.privateNotes} onChange={(event) => update("privateNotes", event.target.value)} maxLength={10000} placeholder="Working notes and reminders" className={field} /></label>
            <div className="border-t border-white/10 pt-4"><h4 className="text-sm font-medium">ASR · Advanced Self Review</h4><p className="mt-1 text-xs leading-5 text-zinc-500">{closed ? "Assess the result achievable with perfect management of your intended strategy." : "Available after this trade closes."}</p></div>
            <fieldset disabled={!closed} className="space-y-4 disabled:opacity-40">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-zinc-300">Expected R<input aria-label="Expected R" type="number" inputMode="decimal" step="any" min={-100} max={100} value={expected} onChange={(event) => setExpected(event.target.value)} placeholder="e.g. 2.5" className={field} /><span className="mt-1 block text-xs text-zinc-500">Same 1R basis as the actual result.</span></label>
                <label className="block text-sm text-zinc-300">Trade validity<select aria-label="Trade validity" value={annotation.valid === null ? "unset" : annotation.valid ? "valid" : "invalid"} onChange={(event) => setAnnotation((previous) => ({ ...previous, valid: event.target.value === "unset" ? null : event.target.value === "valid" }))} className={field}><option value="unset">Not reviewed</option><option value="valid">Valid trade</option><option value="invalid">Invalid trade</option></select></label>
              </div>
              <label className="block text-sm text-zinc-300">ASR comments<textarea aria-label="ASR comments" rows={4} value={annotation.asrComments} onChange={(event) => update("asrComments", event.target.value)} maxLength={10000} placeholder="Your assessment of the setup and management" className={field} /></label>
            </fieldset>
          </section>
        </>}
      </div>
      <footer className="shrink-0 border-t border-white/10 bg-[#07090d] p-4 sm:px-6">
        {!loading && error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
        <div className="flex items-center justify-between gap-3"><p className="max-w-56 text-xs leading-5 text-zinc-500">Saving edits does not publish a trade.</p><div className="flex shrink-0 gap-2"><button type="button" onClick={close} disabled={saving || creating} className="rounded-lg px-3 py-2.5 text-sm text-zinc-400">Cancel</button><button type="submit" disabled={loading || saving || creating || !dirty} className="rounded-lg bg-[#ff6719] px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">{saving ? "Saving…" : "Save changes"}</button></div></div>
      </footer>
    </form>
  </dialog>;
}
