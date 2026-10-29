"use client";

import { useState } from "react";
import type { IdeaEditorData, IdeaFields } from "@/lib/performance/ideas-model";

export default function TradeIdeaFields({ editor, selected, fields, onSelect, onFields }: {
  editor: IdeaEditorData; selected: string; fields: IdeaFields;
  onSelect: (id: string) => void; onFields: (fields: IdeaFields) => void;
}) {
  const [query, setQuery] = useState("");
  const input = "mt-1.5 w-full min-w-0 rounded-lg border border-white/15 bg-black px-3 py-2.5 text-sm text-zinc-100";
  const matches = editor.ideas.filter(i => i.id === selected || i.name.toLowerCase().includes(query.trim().toLowerCase()));
  if (!editor.eligible) return <p className="text-xs text-zinc-500">Idea assignment is available for canonical closed trades.</p>;
  return <fieldset className="space-y-3" aria-label="Trade idea">
    <legend className="text-sm font-medium text-zinc-300">Idea <span className="text-xs font-normal text-zinc-500">· Private</span></legend>
    <label className="block text-xs text-zinc-400">Find an idea<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search idea names…" className={input} /></label>
    <label className="block text-sm text-zinc-300">Assigned idea<select aria-label="Assigned idea" value={selected} onChange={e => onSelect(e.target.value)} className={input}>
      <option value="">Unassigned</option>
      {matches.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      <option value="new">+ Create new idea</option>
    </select></label>
    {selected === "new" && <div className="space-y-3 rounded-xl border border-white/10 p-3">
      <p className="text-xs text-zinc-500">Created and assigned when you save this trade.</p>
      <label className="block text-sm text-zinc-300">New idea name<input aria-label="New idea name" required maxLength={120} value={fields.name} onChange={e => onFields({ ...fields, name: e.target.value })} className={input} /></label>
      {([{ key: "thesis", label: "Thesis / intended move", max: 5000 }, { key: "target", label: "Target / target zone", max: 1000 }, { key: "invalidation", label: "Invalidation", max: 1000 }, { key: "notes", label: "Idea review notes", max: 10000 }] as const).map(f => <label key={f.key} className="block text-sm text-zinc-300">{f.label}<textarea rows={2} maxLength={f.max} value={fields[f.key]} onChange={e => onFields({ ...fields, [f.key]: e.target.value })} className={input} /></label>)}
    </div>}
  </fieldset>;
}
