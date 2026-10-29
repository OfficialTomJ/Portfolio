"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { EMPTY_IDEA_FIELDS, summariseIdea, type IdeaFields, type IdeaGroups, type IdeaMutation, type IdeasSnapshot, type IdeaTrade, type TradeIdea } from "@/lib/performance/ideas-model";
import { signedR, sydneyDateKey } from "@/lib/performance/metrics";
import type { MarketCandles } from "@/lib/performance/types";
import TradeEditorButton from "./TradeEditor";
import TradePriceChart from "./TradePriceChart";

const field = "mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#ff8b52]";
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const primary = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[#ff6719] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#ff8b52] disabled:cursor-not-allowed disabled:opacity-40";
const date = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" });
const rClass = (r: number | null) => r === null ? "text-zinc-500" : r > 0 ? "text-emerald-400" : r < 0 ? "text-red-400" : "text-zinc-300";
const result = (r: number | null) => r === null ? "Not included" : signedR(r);

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[94dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-[#07090d] p-0 text-zinc-100 backdrop:bg-black/80">
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#07090d] p-4 sm:px-5"><h2 id={id} className="text-lg font-medium">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog" className={`${button} shrink-0`}>Close</button></header>
    {children}
  </dialog>;
}

function IdeaForm({ idea, count, busy, error, conflict, onSave, onClose, onReload }: {
  idea: TradeIdea | null; count: number; busy: boolean; error: string; conflict: boolean;
  onSave: (fields: IdeaFields) => Promise<void>; onClose: () => void; onReload: () => Promise<void>;
}) {
  const initial = idea ? { name: idea.name, thesis: idea.thesis, target: idea.target, invalidation: idea.invalidation, notes: idea.notes } : EMPTY_IDEA_FIELDS;
  const [fields, setFields] = useState<IdeaFields>(initial);
  const dirty = JSON.stringify(fields) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const close = () => { if (!busy && (!dirty || window.confirm("Discard your unsaved idea details?"))) onClose(); };
  return <Modal title={idea ? "Edit idea" : "New idea"} onClose={close}>
    <form onSubmit={event => { event.preventDefault(); void onSave(fields); }} className="space-y-4 p-4 sm:p-5">
      <p className="text-sm leading-6 text-zinc-400">A directional thesis aimed at one move. {count ? `${count} selected ${count === 1 ? "trade will" : "trades will"} be assigned when you create it.` : "You can add trades afterward."}</p>
      <label className="block text-sm text-zinc-300">Idea name <span className="text-[#ff8b52]">*</span><input autoFocus required maxLength={120} value={fields.name} onChange={e => setFields({ ...fields, name: e.target.value })} placeholder="e.g. HYPE recovery towards $100" className={field} /></label>
      <label className="block text-sm text-zinc-300">Thesis / intended move<textarea rows={3} maxLength={5000} value={fields.thesis} onChange={e => setFields({ ...fields, thesis: e.target.value })} placeholder="What move were you trying to catch?" className={field} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-300">Target / target zone<textarea rows={2} maxLength={1000} value={fields.target} onChange={e => setFields({ ...fields, target: e.target.value })} placeholder="Price, zone or structural target" className={field} /></label>
        <label className="block text-sm text-zinc-300">Invalidation<textarea rows={2} maxLength={1000} value={fields.invalidation} onChange={e => setFields({ ...fields, invalidation: e.target.value })} placeholder="What would have ended the idea?" className={field} /></label>
      </div>
      <label className="block text-sm text-zinc-300">Review notes<textarea rows={3} maxLength={10000} value={fields.notes} onChange={e => setFields({ ...fields, notes: e.target.value })} placeholder="Anything useful for investigating this idea later" className={field} /></label>
      <p className="text-xs leading-5 text-zinc-500">Only the name is required. Leave details blank if they weren&apos;t recorded at the time.</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {conflict && <button type="button" onClick={() => { if (!dirty || window.confirm("Discard this draft and reload the saved workspace?")) void onReload(); }} className={button}>Reload saved workspace</button>}
      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4"><button type="submit" disabled={busy || conflict || !fields.name.trim() || (!!idea && !dirty)} className={primary}>{busy ? "Saving…" : idea ? "Save idea" : count ? `Create & assign ${count}` : "Create idea"}</button><button type="button" disabled={busy} onClick={close} className={button}>Cancel</button></div>
    </form>
  </Modal>;
}

function TradeContext({ row, ideaName, onClose }: { row: IdeaTrade; ideaName: string | null; onClose: () => void }) {
  const [market, setMarket] = useState<MarketCandles | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function loadChart() {
    if (!row.trade) return;
    controller.current = new AbortController(); setLoading(true); setError("");
    const query = new URLSearchParams({ symbol: row.symbol, interval: "4h", direction: "window", start: String(Math.floor(Date.parse(row.openedAt) / 1000) - 24 * 14400), end: String(Math.ceil(Date.parse(row.closedAt) / 1000) + 24 * 14400) });
    try {
      const response = await fetch(`/api/performance/market?${query}`, { signal: controller.current.signal });
      if (!response.ok) throw new Error("Price chart unavailable. Your notes and grouping are still available.");
      const data: MarketCandles = await response.json();
      if (!Array.isArray(data.candles) || !data.candles.length) throw new Error("No candles available for this trade.");
      setMarket(data);
    } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Chart unavailable"); }
    finally { setLoading(false); }
  }
  return <Modal title={`${row.symbol.replace("USDT", "")} · ${row.direction}`} onClose={onClose}>
    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-zinc-400">{ideaName ?? "Unassigned"}</p><p className={`text-2xl font-medium tabular-nums ${rClass(row.resultR)}`}>{result(row.resultR)}</p></div>
      <dl className="grid grid-cols-2 gap-4 text-xs text-zinc-400"><div><dt className="text-zinc-500">Entry · Sydney</dt><dd className="mt-1">{time.format(new Date(row.openedAt))}</dd></div><div><dt className="text-zinc-500">Exit · Sydney</dt><dd className="mt-1">{time.format(new Date(row.closedAt))}</dd></div></dl>
      {row.warning && <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">{row.warning}</p>}
      {[{ title: "Private notes", text: row.privateNotes }, { title: "ASR comments", text: row.asrComments }, { title: "Trade description", text: row.description }].map(item => <section key={item.title}><h3 className="text-sm font-medium text-zinc-200">{item.title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">{item.text || "No notes recorded."}</p></section>)}
      {row.trade && <section className="border-t border-white/10 pt-4">{market ? <TradePriceChart trade={row.trade} candles={market.candles} source={market.source} initialInterval="4h" /> : <button type="button" disabled={loading} onClick={() => void loadChart()} className={button}>{loading ? "Loading price chart…" : "Load price chart"}</button>}{error && <p role="status" className="mt-2 text-sm text-zinc-400">{error}</p>}<a href={`/performance/review/trades/${row.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-block min-h-10 py-2 text-xs text-[#ff8b52]">Open full trade review ↗</a></section>}
    </div>
  </Modal>;
}

function Metric({ label, value, tone = "text-zinc-100" }: { label: string; value: string; tone?: string }) {
  return <div className="min-w-0"><dt className="text-[11px] text-zinc-500">{label}</dt><dd className={`mt-1 break-words text-lg font-medium tabular-nums ${tone}`}>{value}</dd></div>;
}

export default function AdminIdeasManager({ initial }: { initial: IdeasSnapshot }) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState("unassigned");
  const [search, setSearch] = useState("");
  const [ideaFilter, setIdeaFilter] = useState("");
  const [direction, setDirection] = useState("");
  const [strategy, setStrategy] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const [activeId, setActiveId] = useState(initial.ideas[0]?.id ?? "");
  const [form, setForm] = useState<{ idea: TradeIdea | null; tradeIds: string[] } | null>(null);
  const [contextId, setContextId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const eligible = data.trades.filter(t => !t.duplicateOf);
  const assigned = eligible.filter(t => data.assignments[t.id]);
  const exceptions = data.trades.filter(t => t.exception);
  const unassigned = eligible.length - assigned.length;
  const active = data.ideas.find(i => i.id === activeId) ?? null;
  const members = active ? eligible.filter(t => data.assignments[t.id] === active.id) : [];
  const summary = summariseIdea(members);
  const strategies = [...new Set(data.trades.flatMap(t => t.strategies))].sort();
  const query = search.toLowerCase().trim();
  const visible = data.trades.filter(t => {
    const idea = data.ideas.find(i => i.id === data.assignments[t.id]);
    const day = sydneyDateKey(t.openedAt);
    return (view === "exceptions" ? t.exception : !t.duplicateOf && (view === "all" || (view === "unassigned" ? !idea : !!idea))) &&
      (!query || [t.symbol, t.direction, idea?.name ?? "", ...t.strategies, t.privateNotes, t.asrComments].some(s => s.toLowerCase().includes(query))) &&
      (!ideaFilter || data.assignments[t.id] === ideaFilter) && (!direction || direction === t.direction) && (!strategy || t.strategies.includes(strategy)) && (!from || day >= from) && (!to || day <= to);
  });
  const selectable = visible.filter(t => !t.duplicateOf);
  const allSelected = selectable.length > 0 && selectable.every(t => selected.includes(t.id));
  const context = data.trades.find(t => t.id === contextId);
  const flags = eligible.filter(t => t.warning).length;
  const changeFilter = () => setSelected([]);
  const chooseIdea = (id: string) => { setActiveId(id); setTargetId(id); };
  function openForm(idea: TradeIdea | null, tradeIds: string[] = []) { setError(""); setMessage(""); setForm({ idea, tradeIds }); }
  async function save(command: IdeaMutation): Promise<IdeaGroups | null> {
    if (busy || conflict) return null;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/performance/admin/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
      const body = await response.json();
      if (!response.ok) { if (response.status === 409) setConflict(true); throw new Error(body.error ?? "Could not save"); }
      const groups: IdeaGroups = body;
      setData(previous => ({ ...previous, ...groups }));
      setSelected([]);
      setMessage(command.action === "assign" ? command.ideaId ? `${command.tradeIds.length} ${command.tradeIds.length === 1 ? "trade assigned" : "trades assigned"}.` : "Selected trades unassigned." : command.action === "delete" ? "Empty idea deleted." : "Idea saved.");
      return groups;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Please try again."); return null; }
    finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/performance/admin/ideas", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not reload");
      setData(body); setSelected([]); setForm(null); setConflict(false); setMessage("Saved workspace reloaded.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reload"); }
    finally { setBusy(false); }
  }
  async function saveForm(fields: IdeaFields) {
    if (!form) return;
    const groups = await save(form.idea ? { action: "update", revision: data.revision, ideaId: form.idea.id, fields } : { action: "create", revision: data.revision, fields, tradeIds: form.tradeIds });
    if (!groups) return;
    if (!form.idea) { const created = groups.ideas.find(i => !data.ideas.some(old => old.id === i.id)); if (created) chooseIdea(created.id); }
    setForm(null);
  }

  return <div className="space-y-5">
    <section aria-label="Categorisation progress" className="rounded-2xl border border-white/10 bg-[#07090d] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-zinc-500">All history · {data.environment} account</p><p className="mt-1 text-2xl font-medium text-white">{assigned.length}<span className="text-zinc-500"> / {eligible.length}</span> <span className="text-base text-zinc-400">trades categorised</span></p></div><button type="button" disabled={busy || conflict} onClick={() => openForm(null)} className={primary}>+ New idea</button></div>
      <div role="progressbar" aria-label="Trades categorised" aria-valuenow={assigned.length} aria-valuemin={0} aria-valuemax={eligible.length || 1} className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[#ff6719] transition-all" style={{ width: `${eligible.length ? assigned.length / eligible.length * 100 : 0}%` }} /></div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{data.ideas.length} {data.ideas.length === 1 ? "idea" : "ideas"} · {unassigned} unassigned · Entries shown oldest first · Dates in Sydney time</p>
    </section>
    {flags > 0 && <details className="rounded-xl border border-amber-400/15 bg-amber-400/[0.035] px-4 py-3 text-xs leading-5 text-amber-200/80"><summary className="cursor-pointer">{flags} trades have data notices · {data.trades.filter(t => t.duplicateOf).length} duplicate records kept separate</summary><p className="mt-2">Excluded and unresolved trades can be grouped, but contribute no result to totals. Duplicate aliases cannot be assigned. Where PnL attribution differs, totals use the existing journal result. Notices remain visible on affected ideas.</p></details>}
    {(message || error) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"><p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>{error || message}</p>{conflict && <button type="button" onClick={() => void reload()} disabled={busy} className={button}>Reload saved workspace</button>}</div>}
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section aria-label="Historical trades" className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]">
        <header className="space-y-4 border-b border-white/10 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium text-white">Trade history</h2><span className="text-xs text-zinc-500">{visible.length} shown</span></div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Trade assignment filter">{[{ id: "unassigned", label: `Unassigned (${unassigned})` }, { id: "all", label: "All history" }, { id: "assigned", label: `Assigned (${assigned.length})` }, { id: "exceptions", label: `Exceptions (${exceptions.length})` }].map(tab => <button key={tab.id} type="button" aria-pressed={view === tab.id} onClick={() => { setView(tab.id); changeFilter(); }} className={`min-h-10 rounded-lg border px-3 py-2 text-xs ${view === tab.id ? "border-[#ff6719]/35 bg-[#ff6719]/10 text-[#ffad83]" : "border-white/10 text-zinc-400 hover:text-white"}`}>{tab.label}</button>)}</div>
          <label className="block text-xs text-zinc-400">Filter by idea<select aria-label="Filter by idea" value={ideaFilter} onChange={e => { setIdeaFilter(e.target.value); if (e.target.value) setView("all"); changeFilter(); }} className={field}><option value="">All ideas</option>{data.ideas.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
          <label className="block text-xs text-zinc-400">Search trades<input type="search" value={search} onChange={e => { setSearch(e.target.value); changeFilter(); }} placeholder="Symbol, strategy, idea or notes" className={field} /></label>
          <details><summary className="cursor-pointer py-1 text-xs text-zinc-400">More filters{direction || strategy || from || to ? " · Active" : ""}</summary><div className="mt-2 grid grid-cols-2 gap-3">
            <label className="text-xs text-zinc-400">Direction<select value={direction} onChange={e => { setDirection(e.target.value); changeFilter(); }} className={field}><option value="">All directions</option><option>Long</option><option>Short</option></select></label>
            <label className="text-xs text-zinc-400">Strategy<select value={strategy} onChange={e => { setStrategy(e.target.value); changeFilter(); }} className={field}><option value="">All strategies</option>{strategies.map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="text-xs text-zinc-400">Entry from<input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); changeFilter(); }} className={`${field} [color-scheme:dark]`} /></label>
            <label className="text-xs text-zinc-400">Entry to<input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); changeFilter(); }} className={`${field} [color-scheme:dark]`} /></label>
          </div></details>
          {(query || ideaFilter || direction || strategy || from || to) && <button type="button" onClick={() => { setSearch(""); setIdeaFilter(""); setDirection(""); setStrategy(""); setFrom(""); setTo(""); changeFilter(); }} className="min-h-10 text-xs text-[#ff8b52]">Clear filters</button>}
        </header>
        <div className="border-b border-white/10 bg-white/[0.015] p-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex min-h-10 cursor-pointer items-center gap-3 text-xs text-zinc-300"><input type="checkbox" aria-label="Select all shown trades" checked={allSelected} disabled={!selectable.length || busy || conflict} onChange={() => setSelected(allSelected ? [] : selectable.slice(0, 200).map(t => t.id))} className="size-4 accent-[#ff6719]" />{selected.length ? `${selected.length} selected` : "Select trades to group"}</label>{selected.length > 0 && <button type="button" onClick={() => setSelected([])} disabled={busy} className="min-h-10 text-xs text-zinc-400">Clear selection</button>}</div>
          {selected.length > 0 && <div className="mt-3 space-y-3"><label className="block text-xs text-zinc-400">Assign selected trades to<select aria-label="Assign selected trades to" value={targetId} onChange={e => setTargetId(e.target.value)} disabled={busy || conflict} className={field}><option value="">Choose an idea</option>{data.ideas.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label><div className="flex flex-wrap gap-2"><button type="button" disabled={!targetId || busy || conflict} onClick={() => { void save({ action: "assign", revision: data.revision, ideaId: targetId, tradeIds: selected }).then(groups => { if (groups) setActiveId(targetId); }); }} className={primary}>{busy ? "Saving…" : "Assign selected"}</button><button type="button" disabled={busy || conflict} onClick={() => openForm(null, selected)} className={button}>Create idea with selected</button>{selected.some(id => data.assignments[id]) && <button type="button" disabled={busy || conflict} onClick={() => void save({ action: "assign", revision: data.revision, ideaId: null, tradeIds: selected })} className={button}>Unassign selected</button>}</div></div>}
        </div>
        <div className="max-h-[900px] divide-y divide-white/[0.06] overflow-y-auto">
          {visible.map(t => {
            const idea = data.ideas.find(i => i.id === data.assignments[t.id]);
            return <article key={t.id} data-idea-trade-id={t.id} className={`p-4 sm:px-5 ${selected.includes(t.id) ? "bg-[#ff6719]/[0.055]" : ""}`}>
              <div className="flex items-start gap-3"><input type="checkbox" aria-label={`Select ${t.symbol} ${t.direction} ${time.format(new Date(t.openedAt))}`} checked={selected.includes(t.id)} disabled={!!t.duplicateOf || busy || conflict} onChange={() => setSelected(previous => previous.includes(t.id) ? previous.filter(id => id !== t.id) : previous.length < 200 ? [...previous, t.id] : previous)} className="mt-2 size-4 shrink-0 accent-[#ff6719] disabled:opacity-30" />
                <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => setContextId(t.id)} className="min-w-0 text-left"><span className="text-sm font-medium text-zinc-100 hover:text-[#ffad83]">{t.symbol.replace("USDT", "")} <span className={`ml-1 text-xs ${t.direction === "Long" ? "text-emerald-400/80" : "text-red-400/80"}`}>{t.direction}</span></span><span className="mt-1 block text-[11px] leading-5 text-zinc-500">{time.format(new Date(t.openedAt))}</span></button><span className={`shrink-0 text-sm font-medium tabular-nums ${rClass(t.resultR)}`}>{result(t.resultR)}</span></div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-zinc-400"><span className="rounded border border-white/10 px-1.5 py-0.5">{t.duplicateOf ? "Duplicate" : t.status === "published" ? "Published" : t.status === "pending_review" ? "Unpublished" : t.status === "excluded" ? "Excluded" : "Needs reconciliation"}</span>{t.tradeType && <span className="rounded border border-white/10 px-1.5 py-0.5">{t.tradeType}</span>}{t.strategies.map(s => <span key={s} className="rounded border border-white/10 px-1.5 py-0.5">{s}</span>)}{t.warning && !t.exception && <span className="rounded border border-amber-400/20 px-1.5 py-0.5 text-amber-200/70">Data notice</span>}</div>
                  {t.trade && <div className="mt-3"><TradeEditorButton trade={t.trade} editIdeas onSaved={() => { void reload(); }} /></div>}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className={`min-w-0 break-words text-xs ${idea ? "text-[#ffad83]" : "text-zinc-600"}`}>{idea?.name ?? (t.duplicateOf ? "Alias · not counted" : "No idea assigned")}</p><button type="button" onClick={() => setContextId(t.id)} className="min-h-9 text-[11px] text-zinc-400 hover:text-white">Notes & chart ↗</button></div>
                </div>
              </div>
            </article>;
          })}
          {!visible.length && <div className="px-5 py-14 text-center"><p className="text-sm text-zinc-200">{view === "unassigned" && !unassigned ? "All historical trades are categorised." : "No trades in this selection."}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{view === "unassigned" && !unassigned ? "Your ideas are ready for review." : "Try another filter or switch to all history."}</p></div>}
        </div>
      </section>

      <aside aria-label="Idea details" className="min-w-0 space-y-4 lg:sticky lg:top-20">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]">
          <header className="border-b border-white/10 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium text-white">Your ideas</h2><span className="text-xs text-zinc-500">{data.ideas.length}</span></div>{data.ideas.length > 0 && <label className="mt-3 block text-xs text-zinc-400">View idea<select aria-label="View idea" value={active?.id ?? ""} onChange={e => chooseIdea(e.target.value)} className={field}><option value="" disabled>Choose an idea</option>{data.ideas.map(i => <option key={i.id} value={i.id}>{i.name} · {eligible.filter(t => data.assignments[t.id] === i.id).length} trades</option>)}</select></label>}</header>
          {active ? <div className="space-y-5 p-4 sm:p-5">
            <div><div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words text-xl font-medium leading-7 text-white">{active.name}</h3><button type="button" disabled={busy || conflict} onClick={() => openForm(active)} className={`${button} shrink-0`}>Edit</button></div>{active.thesis && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">{active.thesis}</p>}</div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-500">{summary.unknownCount ? "Partial net realised result" : "Net realised result"}</p><p className={`mt-1 text-4xl font-medium tracking-tight tabular-nums ${rClass(summary.netR)}`}>{summary.netR === null ? "—" : signedR(summary.netR)}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{summary.knownCount} of {summary.count} trades included · Fixed journal base R</p><dl className="mt-5 grid grid-cols-2 gap-4"><Metric label="Gross winning R" value={signedR(summary.grossWins)} tone="text-emerald-400" /><Metric label="Realised losses" value={signedR(summary.grossLosses)} tone="text-red-400" /><Metric label="Trades" value={String(summary.count)} /><Metric label="Winners / losers" value={`${summary.winners} / ${summary.losers}`} /></dl></div>
            {(summary.unknownCount > 0 || summary.warningCount > 0) && <p className="text-xs leading-5 text-amber-200/80">{summary.unknownCount > 0 ? `${summary.unknownCount} assigned trades have no included result. ` : ""}{summary.warningCount > 0 ? "Data notices affect this idea; totals may be incomplete." : ""}</p>}
            {(active.target || active.invalidation) && <dl className="space-y-3">{[{ label: "Target / target zone", value: active.target }, { label: "Invalidation", value: active.invalidation }].filter(x => x.value).map(item => <div key={item.label}><dt className="text-xs text-zinc-500">{item.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">{item.value}</dd></div>)}</dl>}
            {summary.firstEntry && <p className="text-xs leading-5 text-zinc-500">{date.format(new Date(summary.firstEntry))} – {date.format(new Date(summary.lastExit!))}</p>}
            {active.notes && <section><h4 className="text-xs text-zinc-500">Review notes</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">{active.notes}</p></section>}
            <section className="border-t border-white/10 pt-4"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-medium text-zinc-200">Trade timeline</h4><span className="text-[10px] text-zinc-500">Cumulative base R</span></div><ol className="mt-3 space-y-1">{summary.timeline.map(t => <li key={t.id}><button type="button" onClick={() => setContextId(t.id)} className="flex min-h-14 w-full items-start justify-between gap-3 rounded-lg px-2 py-3 text-left hover:bg-white/[0.03]"><div className="min-w-0"><p className="text-xs text-zinc-300">{t.symbol.replace("USDT", "")} · {t.direction} <span className={`ml-2 tabular-nums ${rClass(t.resultR)}`}>{result(t.resultR)}</span></p><p className="mt-1 text-[10px] text-zinc-500">Closed {time.format(new Date(t.closedAt))}</p></div><span className={`shrink-0 text-xs tabular-nums ${rClass(t.cumulativeR)}`}>{t.cumulativeR === null ? "—" : signedR(t.cumulativeR)}</span></button></li>)}</ol>{!members.length && <p className="mt-3 text-sm leading-6 text-zinc-500">Select trades from the history and assign them to this idea.</p>}</section>
            {!Object.values(data.assignments).includes(active.id) && <button type="button" disabled={busy || conflict} onClick={() => { if (window.confirm(`Delete the empty idea “${active.name}”?`)) void save({ action: "delete", revision: data.revision, ideaId: active.id }).then(groups => { if (groups) chooseIdea(groups.ideas[0]?.id ?? ""); }); }} className="min-h-10 text-xs text-zinc-500 hover:text-red-300">Delete empty idea</button>}
          </div> : <div className="p-6 py-12 text-center"><div className="mx-auto grid size-12 place-items-center rounded-xl border border-[#ff6719]/20 bg-[#ff6719]/5 text-xl text-[#ff8b52]">↗</div><h3 className="mt-4 text-base text-zinc-200">Start with one move you remember</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-500">Select the trades that belonged to it, then create an idea. You can adjust every grouping later.</p><button type="button" disabled={busy || conflict} onClick={() => openForm(null, selected)} className={`${button} mt-5`}>{selected.length ? `Create idea with ${selected.length} selected` : "Create your first idea"}</button></div>}
        </section>
        <p className="px-1 text-[11px] leading-5 text-zinc-600">Idea assignments are saved to the journal database. Last trade sync: {time.format(new Date(data.lastSyncAt))}. One idea may include several symbols.</p>
      </aside>
    </div>
    {form && <IdeaForm idea={form.idea} count={form.tradeIds.length} busy={busy} error={error} conflict={conflict} onSave={saveForm} onClose={() => setForm(null)} onReload={reload} />}
    {context && <TradeContext key={context.id} row={context} ideaName={data.ideas.find(i => i.id === data.assignments[context.id])?.name ?? null} onClose={() => setContextId(null)} />}
  </div>;
}
