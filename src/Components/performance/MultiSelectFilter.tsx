"use client";
import { useId, useRef, useState, type CSSProperties } from "react";

export default function MultiSelectFilter({ label, options, selected, onChange, searchable = false }: {
  label: string; options: { id: string; name: string }[]; selected: string[];
  onChange: (ids: string[]) => void; searchable?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<CSSProperties>({});
  return <div className="min-w-0 min-[480px]:w-44">
    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">{label}</p>
    <button type="button" aria-label={label} aria-expanded={open} popoverTarget={id} onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 16;
      const height = Math.min(320, Math.max(below, rect.top - 16));
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: below >= Math.min(240, height) ? rect.bottom + 6 : Math.max(12, rect.top - height - 6), width, maxHeight: height });
    }} className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black px-3 text-left text-sm text-zinc-200 outline-none focus-visible:border-[#ff6719]/60">
      <span className="truncate">{selected.length ? `${selected.length} selected` : `All ${label.toLowerCase()}`}</span><span aria-hidden="true" className="text-xs text-zinc-500">▾</span>
    </button>
    <div ref={panel} id={id} popover="auto" onToggle={event => { setOpen(event.newState === "open"); if(event.newState === "closed")setQuery(""); }} style={{ position: "fixed", inset: "auto", margin: 0, ...position }} className="overflow-y-auto rounded-xl border border-white/15 bg-[#0b0d11] p-3 text-zinc-100 shadow-2xl">
      <p className="mb-2 text-xs font-medium">{label}</p>
      {searchable && <input aria-label={`Search ${label.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search strategies…" className="mb-2 h-10 w-full rounded-lg border border-white/15 bg-black px-3 text-sm outline-none focus:border-[#ff6719]/60" />}
      <div role="group" aria-label={`${label} options`} className="space-y-1">{options.filter(option => option.name.toLowerCase().includes(query.trim().toLowerCase())).map(option => <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-white/5"><input type="checkbox" checked={selected.includes(option.id)} onChange={() => onChange(selected.includes(option.id) ? selected.filter(value => value !== option.id) : [...selected, option.id])} className="size-4 shrink-0 accent-[#ff6719]" /><span className="min-w-0 break-words">{option.name}</span></label>)}</div>
      {!options.length && <p className="py-3 text-xs text-zinc-500">Create a strategy in Edit trade.</p>}
      <div className="mt-2 flex justify-between gap-3 border-t border-white/10 pt-3"><button type="button" disabled={!selected.length} onClick={() => onChange([])} className="text-xs text-zinc-400 disabled:opacity-40">Clear selection</button><button type="button" onClick={() => panel.current?.hidePopover()} className="rounded-lg border border-[#ff6719]/30 px-3 py-1.5 text-xs text-[#ffad83]">Done</button></div>
    </div>
  </div>;
}
