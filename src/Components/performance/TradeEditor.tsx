"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EMPTY_ANNOTATION, type TradeAnnotation } from "@/lib/performance/annotations-model";
import type { TradeTag, TradeDirection } from "@/lib/performance/types";
import { signedR } from "@/lib/performance/metrics";
import type { AdminPublication } from "@/lib/performance/admin-publication";
import AdminPublishButton from "./AdminPublishButton";

export interface EditableTradeSummary { id: string; symbol: string; direction: TradeDirection; resultR?: number }
const field = "mt-1.5 w-full min-w-0 rounded-lg border border-white/15 bg-black px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#ff6719]/70";
type EditorProps = { trade: EditableTradeSummary; initialAnnotation?: TradeAnnotation; initialTags: TradeTag[]; initialPublication?: AdminPublication; onClose?: () => void; inline?: boolean; nextTradeId?: string | null };

export default function TradeEditorButton({ trade, initialAnnotation, initialTags = [], initialPublication, className = "" }: {
  trade: EditableTradeSummary; initialAnnotation?: TradeAnnotation; initialTags?: TradeTag[]; initialPublication?: AdminPublication; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className={`min-h-11 rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 transition hover:border-[#ff6719]/50 hover:text-white ${className}`} aria-label={`Edit ${trade.symbol} trade`}>Edit trade</button>{open && <TradeEditor trade={trade} initialAnnotation={initialAnnotation} initialTags={initialTags} initialPublication={initialPublication} onClose={() => setOpen(false)} />}</>;
}

export function InlineTradeEditor(props: Omit<EditorProps, "inline" | "onClose">) {
  return <TradeEditor key={props.trade.id} {...props} inline />;
}

function TradeEditor({ trade, initialAnnotation, initialTags, initialPublication, onClose, inline = false, nextTradeId }: EditorProps) {
  const router = useRouter();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const seeded = useRef(initialAnnotation !== undefined);
  const edited = useRef(false);
  const revision = useRef(initialAnnotation?.revision ?? 0);
  const confirmedPublished = useRef(false);
  const [annotation, setAnnotation] = useState<TradeAnnotation>(initialAnnotation ?? { ...EMPTY_ANNOTATION });
  const [original, setOriginal] = useState(initialAnnotation ? JSON.stringify(initialAnnotation) : "");
  const [expected, setExpected] = useState(initialAnnotation?.expectedR == null ? "" : String(initialAnnotation.expectedR));
  const [tags, setTags] = useState<TradeTag[]>(initialTags);
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState(trade.resultR !== undefined);
  const [loading, setLoading] = useState(initialAnnotation === undefined);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publication, setPublication] = useState<AdminPublication | undefined>(initialPublication);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const payload = { ...annotation, expectedR: expected.trim() === "" ? null : Number(expected) };
  const dirty = !loading && JSON.stringify(payload) !== original;
  const complete = closed && payload.expectedR !== null && Number.isFinite(payload.expectedR) && Math.abs(payload.expectedR) <= 100 && annotation.valid !== null;

  const applySaved = useCallback((next: TradeAnnotation) => {
    revision.current = next.revision;
    edited.current = false;
    setAnnotation(next); setExpected(next.expectedR == null ? "" : String(next.expectedR)); setOriginal(JSON.stringify(next));
  }, []);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    if (!inline) { element?.showModal(); document.body.style.overflow = "hidden"; }
    const controller = new AbortController();
    fetch(`/api/performance/admin/trades/${trade.id}/metadata`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not load editor"); return body; })
      .then(body => {
        if (controller.signal.aborted || body.annotation.revision < revision.current) return;
        if (!edited.current) applySaved(body.annotation);
        setTags(previous => edited.current ? [...new Map([...previous, ...body.tags].map((tag: TradeTag) => [tag.id, tag])).values()] : body.tags);
        setClosed(body.closed); if (!confirmedPublished.current && body.publication) setPublication(body.publication); setLoading(false);
      }).catch(e => { if (e.name !== "AbortError" && !controller.signal.aborted) setError(seeded.current ? "Could not check for newer edits. Saving will still verify this version." : "Could not load this trade. Refresh and try again."); });
    return () => { controller.abort(); if (!inline) { document.body.style.overflow = overflow; element?.close(); } };
  }, [trade.id, inline, applySaved]);

  useEffect(() => {
    if (!inline || !dirty || saving || publishing) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor instanceof HTMLAnchorElement && anchor.target !== "_blank" && !anchor.hasAttribute("download") && anchor.href !== window.location.href && !window.confirm("Discard your unsaved changes?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [inline, dirty, saving, publishing]);

  const close = () => { if (!saving && !creating && !publishing && (!dirty || window.confirm("Discard your unsaved changes?"))) onClose?.(); };
  const update = (key: "description" | "privateNotes" | "asrComments", value: string) => { edited.current = true; setMessage(""); setAnnotation(previous => ({ ...previous, [key]: value })); };
  const toggleTag = (tagId: string) => { edited.current = true; setMessage(""); setAnnotation(previous => ({ ...previous, strategyIds: previous.strategyIds.includes(tagId) ? previous.strategyIds.filter(tag => tag !== tagId) : [...previous.strategyIds, tagId].sort() })); };
  async function createTag() {
    if (!query.trim() || creating) return;
    edited.current = true; setCreating(true); setError("");
    try {
      const response = await fetch("/api/performance/admin/strategies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: query }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setTags(previous => [...previous.filter(tag => tag.id !== result.tag.id), result.tag].sort((a, b) => a.name.localeCompare(b.name)));
      setAnnotation(previous => ({ ...previous, strategyIds: [...new Set([...previous.strategyIds, result.tag.id])].sort() })); setQuery("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create strategy"); } finally { setCreating(false); }
  }
  async function reloadSaved() {
    if (dirty && !window.confirm("Discard your draft and load the saved version?")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/performance/admin/trades/${trade.id}/metadata`, { cache: "no-store" });
      const body = await response.json(); if (!response.ok) throw new Error("Could not reload saved version");
      applySaved(body.annotation); setTags(body.tags); setClosed(body.closed); setPublication(body.publication); setError(""); setConflict(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reload saved version"); } finally { setLoading(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving || loading || creating || publishing) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const next = submitter instanceof HTMLButtonElement && submitter.dataset.action === "next";
    if (next && !complete) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/performance/admin/trades/${trade.id}/metadata`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) { setConflict(response.status === 409); throw new Error(result.error ?? "Could not save changes"); }
      applySaved(result.annotation); setConflict(false);
      if (next) {
        // Re-read the account-scoped queue only after a confirmed save. Never publish.
        const nextResponse = await fetch(`/api/performance/admin/review/next?current=${encodeURIComponent(trade.id)}`, { cache: "no-store" });
        if (!nextResponse.ok) { setMessage("Saved. Could not load the next review; return to the journal."); router.refresh(); return; }
        const destination = await nextResponse.json();
        if (destination.id) router.push(`/performance/review/trades/${destination.id}`);
        else { setMessage("Saved. No other closed trades need ASR."); router.refresh(); }
      } else { setMessage(publication?.status === "unpublished" ? "Saved. Trade remains unpublished." : "Saved"); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save changes"); } finally { setSaving(false); }
  }

  const form = <form onSubmit={save} aria-label={inline ? "Trade review editor" : "Edit trade"} className={inline ? "min-w-0" : "flex h-full max-h-[100dvh] flex-col sm:max-h-[90dvh]"}>
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5"><div><h2 id={id} className="text-lg font-medium">{inline ? "Advanced Self Review" : `${trade.symbol.replace("USDT", " / USDT")} · ${trade.direction}`}</h2><p className="mt-1 text-xs text-zinc-500">{closed ? `Actual result ${signedR(trade.resultR!)}` : "Active position · ASR available after closure"}</p></div>{!inline && <button type="button" onClick={close} aria-label="Close editor" className="size-10 shrink-0 rounded-lg border border-white/10 text-xl text-zinc-400">×</button>}</header>
    <div className={`space-y-5 p-4 sm:p-5 ${inline ? "" : "min-h-0 flex-1 overflow-y-auto"}`}>
      {loading ? <p className="py-8 text-sm text-zinc-400">{error || "Loading trade…"}</p> : <>
        {closed && <fieldset className="space-y-4"><legend className="sr-only">ASR assessment</legend><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm text-zinc-300">Trade validity<select aria-label="Trade validity" value={annotation.valid === null ? "unset" : annotation.valid ? "valid" : "invalid"} onChange={event => { edited.current = true; setMessage(""); setAnnotation(previous => ({ ...previous, valid: event.target.value === "unset" ? null : event.target.value === "valid" })); }} className={field}><option value="unset">Not reviewed</option><option value="valid">Valid trade</option><option value="invalid">Invalid trade</option></select></label><label className="block text-sm text-zinc-300">Expected R<input aria-label="Expected R" type="number" inputMode="decimal" step="any" min={-100} max={100} value={expected} onChange={event => { edited.current = true; setMessage(""); setExpected(event.target.value); }} placeholder="e.g. 2.5" className={field} /></label></div><p className="text-xs leading-5 text-zinc-500">Your assessment with perfect management, on the same 1R basis.</p>{payload.expectedR !== null && Number.isFinite(payload.expectedR) && <p className="text-xs text-zinc-400">Review gap <span className="ml-2 font-medium text-zinc-200">{signedR(payload.expectedR - trade.resultR!)}</span></p>}<label className="block text-sm text-zinc-300">ASR comments<textarea aria-label="ASR comments" rows={4} value={annotation.asrComments} onChange={event => update("asrComments", event.target.value)} maxLength={10000} placeholder="Setup, management and what you would do differently" className={field} /></label></fieldset>}
        <details open={!closed} className="border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-medium text-zinc-300">Classification</summary><div className="mt-4 space-y-4"><label className="block text-sm text-zinc-300">Trade type<select aria-label="Trade type" value={annotation.tradeType ?? ""} onChange={event => { edited.current = true; setMessage(""); setAnnotation(previous => ({ ...previous, tradeType: event.target.value === "DAY" ? "DAY" : event.target.value === "SWING" ? "SWING" : null })); }} className={field}><option value="">Not set</option><option value="DAY">DAY</option><option value="SWING">SWING</option></select><span className="mt-1 block text-xs text-zinc-500">Public once published.</span></label><div><label htmlFor={`${id}-query`} className="text-sm text-zinc-300">Strategies <span className="text-xs text-zinc-500">· Private</span></label><div className="mt-2 flex flex-wrap gap-2">{annotation.strategyIds.map(tagId => <button key={tagId} type="button" onClick={() => toggleTag(tagId)} className="max-w-full break-words rounded-full border border-[#ff6719]/30 bg-[#ff6719]/10 px-3 py-1.5 text-xs text-[#ffad83]" aria-label={`Remove ${tags.find(tag => tag.id === tagId)?.name} strategy`}>{tags.find(tag => tag.id === tagId)?.name} ×</button>)}</div><input id={`${id}-query`} value={query} onChange={event => setQuery(event.target.value)} maxLength={40} placeholder="Find or create a strategy" className={field} /><div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{tags.filter(tag => tag.name.toLowerCase().includes(query.trim().toLowerCase())).map(tag => <button key={tag.id} type="button" aria-pressed={annotation.strategyIds.includes(tag.id)} onClick={() => toggleTag(tag.id)} disabled={!annotation.strategyIds.includes(tag.id) && annotation.strategyIds.length >= 12} className={`max-w-full break-words rounded-lg border px-3 py-2 text-xs ${annotation.strategyIds.includes(tag.id) ? "border-[#ff6719]/40 text-[#ffad83]" : "border-white/10 text-zinc-400"}`}>{annotation.strategyIds.includes(tag.id) ? "✓ " : "+ "}{tag.name}</button>)}</div>{query.trim() && !tags.some(tag => tag.name.toLowerCase() === query.trim().toLowerCase()) && <button type="button" onClick={createTag} disabled={creating || annotation.strategyIds.length >= 12} className="mt-3 max-w-full break-words text-sm text-[#ff8b52]">{creating ? "Creating…" : `Create “${query.trim()}”`}</button>}</div></div></details>
        <details className="border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-medium text-zinc-300">Private notes</summary><label className="mt-3 block"><span className="sr-only">Private notes</span><textarea aria-label="Private notes" rows={3} value={annotation.privateNotes} onChange={event => update("privateNotes", event.target.value)} maxLength={10000} placeholder="Working notes and reminders" className={field} /></label></details>
        <details className="border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-medium text-zinc-300">Public description</summary><label className="mt-3 block"><span className="sr-only">Description</span><textarea aria-label="Description" rows={3} value={annotation.description} onChange={event => update("description", event.target.value)} maxLength={5000} placeholder="Your public write-up for this trade" className={field} /></label><p className="mt-1 text-xs text-zinc-500">Visible on the trade page once published.</p></details>
        {closed && <section aria-label="Publication" className="space-y-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-medium text-zinc-300">Publication</h3><p className="mt-1 text-xs text-zinc-500">{publication?.status === "published" ? "Published" : publication?.status === "unpublished" ? "Unpublished" : "Checking status…"}</p></div>
            {publication?.status === "unpublished" && <AdminPublishButton trade={publication.trade} fingerprint={publication.fingerprint} label="Publish trade" tradeType={annotation.tradeType} description={annotation.description}
              disabled={dirty || loading || saving || creating || conflict} onMessage={setMessage} onPublicationStateChange={id => setPublishing(id !== null)}
              onPublished={() => { confirmedPublished.current = true; setPublication({ status: "published", trade: publication.trade }); }} />}
            {publication?.status === "published" && <a href={`/performance/trades/${trade.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3 text-sm text-zinc-300">View public trade ↗</a>}
          </div>
          <p className="text-xs leading-5 text-zinc-500">{dirty && publication?.status === "unpublished" ? "Save changes before publishing. Saving alone keeps this trade unpublished." : "Publishing is a separate approval. ASR, strategies and private notes stay private."}</p>
        </section>}
      </>}
    </div>
    <footer className="shrink-0 border-t border-white/10 bg-[#07090d] p-4 sm:p-5">
      {!loading && error && <div role="alert" className="mb-3 text-sm text-red-300"><p>{error}</p>{conflict && <button type="button" onClick={reloadSaved} disabled={saving || creating} className="mt-2 min-h-10 underline">Reload saved version</button>}</div>}
      {message && <p role="status" className="mb-3 text-sm text-[#ffad83]">{message}</p>}
      <div className="flex flex-wrap items-center gap-2">{!inline && <button type="button" onClick={close} disabled={saving || creating || publishing} className="min-h-11 rounded-lg px-3 py-2 text-sm text-zinc-400">{dirty ? "Cancel" : "Close"}</button>}<button type="submit" disabled={loading || saving || creating || publishing || !dirty} className="min-h-11 rounded-lg bg-[#ff6719] px-4 py-2 text-sm font-medium text-black disabled:opacity-40">{saving ? "Saving…" : "Save changes"}</button>{inline && nextTradeId && <button type="submit" data-action="next" aria-label="Save and next unreviewed" disabled={loading || saving || creating || publishing || !complete} className="min-h-11 rounded-lg border border-[#ff6719]/40 px-3 py-2 text-sm text-[#ffad83] disabled:opacity-40">Save & next</button>}</div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">Saving never publishes.{inline && nextTradeId ? " Next review includes all periods." : inline ? " End of review queue." : ""}</p>
    </footer>
  </form>;
  return inline ? <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]">{form}</section> : <dialog ref={dialog} aria-labelledby={id} onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); close(); }} className="m-auto h-dvh max-h-none w-full max-w-none border border-white/15 bg-[#07090d] p-0 text-zinc-100 backdrop:bg-black/80 sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl">{form}</dialog>;
}
