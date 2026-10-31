"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TradeIdea } from "@/lib/performance/ideas-model";
import type { IdeaDraft, PublicIdeaFields, WorkspaceRow, WorkspaceSnapshot } from "@/lib/performance/workspace-model";
import { ideaEditorFields } from "@/lib/performance/idea-editor-model";
import { ideaPublicationLabel, ideaPublicationState } from "@/lib/performance/idea-publication-state";
import { signedR } from "@/lib/performance/metrics";
import IdeaTimelineEditor from "./IdeaTimelineEditor";
import IdeaReadiness from "./IdeaReadiness";

const panel="rounded-2xl border border-white/10 bg-[#09090b]";
const field="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-zinc-100 focus:border-[#ff8b52] focus:outline-none";
const button="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40";
const primary=`${button} border-transparent bg-[#ff6719] font-medium !text-black hover:bg-[#ff884a]`;
type Command=(value:Record<string,unknown>)=>Promise<WorkspaceSnapshot>;

export default function IdeasWorkspace({data,command,onRefresh,busy,onMessage,onDirty,initialSelected}:{
  data:WorkspaceSnapshot;command:Command;onRefresh:()=>Promise<void>;busy:boolean;onMessage:(v:string)=>void;onDirty:(v:boolean)=>void;initialSelected?:string|null;
}) {
  const [selected,setSelected]=useState(initialSelected??""),[filter,setFilter]=useState("all"),[search,setSearch]=useState(""),[title,setTitle]=useState(""),[creating,setCreating]=useState(false),[error,setError]=useState("");
  const dirty=useRef(false);
  const drafts=new Map(data.ideaDrafts.map(d=>[d.id,d]));
  const published=data.ideas.ideas.filter(i=>drafts.get(i.id)?.published).length;
  const ideas=[...data.ideas.ideas].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).filter(i=>{
    const draft=drafts.get(i.id),fields=ideaEditorFields(i,draft);
    return fields.title.toLowerCase().includes(search.toLowerCase())&&(filter==="all"||(filter==="published"?!!draft?.published:!draft?.published));
  });
  const idea=data.ideas.ideas.find(i=>i.id===selected),draft=drafts.get(selected);
  async function create(e:React.FormEvent){
    e.preventDefault();if(dirty.current&&!window.confirm("Discard unsaved changes and create a new idea?"))return;
    setCreating(true);setError("");
    try {
      const response=await fetch("/api/performance/admin/ideas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",revision:data.ideas.revision,fields:{name:title,thesis:"",target:"",invalidation:"",notes:""},tradeIds:[]})});
      const body=await response.json();if(!response.ok)throw Error(body.error);
      await onRefresh();setSelected(body.ideas.at(-1)?.id??"");setTitle("");dirty.current=false;onDirty(false);onMessage("Draft idea created. It is private until published.");
    }catch(e){setError((e as Error).message);}finally{setCreating(false);}
  }
  return <section className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">Trading ideas</h2><p className="mt-2 text-xs leading-5 text-zinc-500">{data.ideas.ideas.length-published} drafts · {published} published. One title and one set of idea content.</p></div><p className="max-w-md text-xs leading-5 text-zinc-500">Drafts are private. Published ideas appear in the public journal.</p></header>
    <form onSubmit={create} className={`${panel} flex flex-col gap-3 p-4 sm:flex-row`}><input aria-label="New idea title" required maxLength={120} className={`${field} !mt-0 min-w-0 flex-1`} placeholder="Title for a new idea…" value={title} onChange={e=>setTitle(e.target.value)}/><button type="submit" disabled={creating||busy} className={primary}>{creating?"Creating…":"Create draft"}</button></form>
    {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className={`${panel} min-w-0 overflow-hidden`}><div className="space-y-3 border-b border-white/10 p-4"><input aria-label="Search ideas" className={`${field} !mt-0`} placeholder="Search ideas…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Idea publication filter" className={`${field} !mt-0`} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All ideas</option><option value="draft">Drafts · private</option><option value="published">Published</option></select></div><nav aria-label="Select trading idea" className="max-h-[38rem] overflow-y-auto p-2">{ideas.map(i=>{
        const saved=drafts.get(i.id),fields=ideaEditorFields(i,saved);
        return <button key={i.id} type="button" aria-pressed={selected===i.id} onClick={()=>{if(selected===i.id)return;if(dirty.current&&!window.confirm("Discard unsaved idea changes?"))return;dirty.current=false;onDirty(false);setSelected(i.id);}} className={`mb-1 block w-full rounded-lg border p-3 text-left ${selected===i.id?"border-[#ff6719]/30 bg-[#ff6719]/5":"border-transparent hover:bg-white/[.025]"}`}><span className="block break-words text-sm text-zinc-200">{fields.title}</span><span className={`mt-2 block text-[11px] ${saved?.published?"text-[#ffad83]":"text-zinc-500"}`}>{ideaPublicationLabel[ideaPublicationState(saved)]}</span></button>;
      })}{!ideas.length&&<p className="p-4 text-xs text-zinc-500">No ideas match this selection.</p>}</nav></aside>
      {idea?<IdeaEditor key={`${idea.id}:${draft?.revision??0}`} idea={idea} draft={draft} rows={data.rows} busy={busy} command={command} onMessage={onMessage} onDirty={value=>{dirty.current=value;onDirty(value);}}/>:<div className={`${panel} p-8 text-sm leading-6 text-zinc-500`}>Select an idea or create a draft to begin.</div>}
    </div>
  </section>;
}

function IdeaEditor({idea,draft,rows,busy,command,onMessage,onDirty}:{idea:TradeIdea;draft?:IdeaDraft;rows:WorkspaceRow[];busy:boolean;command:Command;onMessage:(v:string)=>void;onDirty:(v:boolean)=>void}) {
  const initial=ideaEditorFields(idea,draft);
  const [fields,setFields]=useState(initial),[review,setReview]=useState(false),[confirmed,setConfirmed]=useState(false),[error,setError]=useState("");
  const dirty=JSON.stringify(fields)!==JSON.stringify(initial),assigned=rows.filter(r=>r.edit.ideaId===idea.id);
  const ready=!!fields.thesis.trim()&&!!fields.target.trim()&&!!fields.invalidation.trim();
  const pending=!draft?.published||draft.revision!==draft.publishedRevision;
  useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);
  useEffect(()=>{if(!dirty)return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler);},[dirty]);
  const set=<K extends keyof PublicIdeaFields>(key:K,value:PublicIdeaFields[K])=>{setReview(false);setFields(f=>({...f,[key]:value}));};
  async function run(action:string){setError("");try{await command({action,id:idea.id,revision:draft?.revision??0,...(action==="save-idea"?{fields}:{})});onDirty(false);setReview(false);onMessage(action==="save-idea"?"Draft saved. Published content stays unchanged until you publish.":action==="publish-idea"?"Idea published.":"Idea moved to draft. It is no longer publicly visible.");}catch(e){setError((e as Error).message);}}
  return <form onSubmit={e=>{e.preventDefault();void run("save-idea");}} className={`${panel} min-w-0 space-y-5 p-4 sm:p-6`} aria-label="Idea editor">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-medium">Edit idea</h3><p className="mt-1 text-xs text-zinc-500">{draft?.published?pending?"Published version is visible. These saved edits are not public yet.":"This saved version is visible publicly.":"Draft · visible only to you."}{dirty?" Unsaved changes.":""}</p></div>{draft?.published&&<Link href={`/performance/ideas/${idea.id}`} target="_blank" className={button}>View public idea ↗</Link>}</header>
    <label className="block text-xs text-zinc-400">Title<input aria-label="Title" required maxLength={120} className={field} value={fields.title} onChange={e=>set("title",e.target.value)}/></label>
    <label className="block text-xs text-zinc-400">Thesis<textarea aria-label="Thesis" rows={5} maxLength={5000} placeholder="What is the idea, and what would confirm it? Rough notes are fine in a draft." className={field} value={fields.thesis} onChange={e=>set("thesis",e.target.value)}/></label>
    <div className="grid gap-4 sm:grid-cols-2">{([ ["target","Target / scenario"], ["invalidation","Invalidation"] ] as const).map(([key,label])=><label key={key} className="text-xs text-zinc-400">{label}<textarea aria-label={label} rows={3} maxLength={1000} className={field} value={fields[key]} onChange={e=>set(key,e.target.value)}/></label>)}</div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-zinc-400">Idea date &amp; time · GMT<input aria-label="Idea date and time" required type="datetime-local" className={field} value={new Date(fields.ideaAt).toISOString().slice(0,16)} onChange={e=>{if(e.target.value)set("ideaAt",new Date(e.target.value+"Z").toISOString());}}/></label><label className="text-xs text-zinc-400">Outcome<select aria-label="Idea outcome" className={field} value={fields.status} onChange={e=>set("status",e.target.value as PublicIdeaFields["status"])}><option value="active">Active</option><option value="completed">Completed</option><option value="invalidated">Invalidated</option></select></label></div>
    <details className="border-t border-white/10 pt-4"><summary className="min-h-11 cursor-pointer text-sm text-zinc-300">Chart &amp; timeline · {fields.updates?.length??0} updates</summary><IdeaTimelineEditor fields={fields} fallbackSymbol={assigned[0]?.edit.facts.symbol} onChange={next=>{setReview(false);setFields(next);}}/></details>
    <details className="border-t border-white/10 pt-4"><summary className="min-h-11 cursor-pointer text-sm text-zinc-300">Linked trades · {assigned.length}</summary>{assigned.length?assigned.map(r=><p key={r.id} className="mt-2 text-xs leading-6 text-zinc-400">{r.edit.facts.symbol} · {r.edit.facts.direction} · {r.edit.facts.resultR===null?"No closed result":signedR(r.edit.facts.resultR)} · {r.publishedInclusion==="included"&&!r.archived?"Published":"Unpublished / archived"}</p>):<p className="mt-2 text-xs text-zinc-500">No trades linked. Assign trades from their trade editor.</p>}</details>
    <details className="border-t border-white/10 pt-4"><summary className="min-h-11 cursor-pointer text-sm text-zinc-300">Additional context</summary><label className="mt-3 block text-xs text-zinc-400">Analysis article · optional<input type="url" className={field} value={fields.articleUrl} onChange={e=>set("articleUrl",e.target.value)} placeholder="https://…"/></label><div className="mt-4"><IdeaReadiness fields={fields} rows={assigned}/></div></details>
    {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
    <footer className="space-y-3 border-t border-white/10 pt-5"><div className="flex flex-wrap gap-2"><button type="submit" disabled={busy||!!draft&&!dirty} className={primary}>{busy?"Saving…":"Save draft"}</button><button type="button" disabled={busy||dirty||!draft||!ready||!pending} className={button} onClick={()=>{setReview(true);setConfirmed(false);}}>{draft?.published?"Review & publish changes":"Review & publish"}</button>{draft?.published&&<button type="button" disabled={busy||dirty} className={button} onClick={()=>{if(window.confirm("Move this idea to draft and remove its public page? Published trade results remain unchanged."))void run("unpublish-idea");}}>Move to draft</button>}</div><p className="text-[11px] leading-5 text-zinc-500">{!ready?"Drafts can stay rough. Add a thesis, target/scenario and invalidation before publishing.":dirty||!draft?"Save your draft before publishing.":draft.published?"Saving edits does not change the public version. Publish changes when ready.":"This draft stays private until you confirm publication."}</p></footer>
    {review&&<section aria-label="Idea publication confirmation" className="space-y-4 rounded-xl border border-[#ff6719]/30 bg-[#ff6719]/5 p-4"><h4 className="text-base font-medium">Publish this idea?</h4><p className="break-words text-sm font-medium">{fields.title}</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">{fields.thesis}</p><dl className="space-y-3 text-xs leading-6 text-zinc-400">{[["Target / scenario",fields.target],["Invalidation",fields.invalidation],["Outcome",fields.status],["Idea date",fields.ideaAt],["Chart levels",fields.chart?`${fields.chart.symbol} · Target ${fields.chart.targetPrice??"—"} · Invalidation ${fields.chart.invalidationPrice??"—"}`:"None"],["Article",fields.articleUrl||"None"]].map(([label,value])=><div key={label}><dt className="text-zinc-500">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}</dl>{fields.updates?.map(u=><details key={u.id} className="rounded-lg border border-white/10 p-3"><summary className="min-h-11 cursor-pointer break-words text-sm">{u.title} · {u.at.slice(0,10)}</summary><p className="whitespace-pre-wrap break-words text-xs leading-6 text-zinc-400">{u.thesis}</p><p className="mt-2 break-words text-xs leading-6 text-zinc-500">Target: {u.target||"Unchanged"} · Invalidation: {u.invalidation||"Unchanged"}</p>{u.chart&&<p className="mt-2 text-xs text-zinc-500">{u.chart.symbol} · Target {u.chart.targetPrice??"—"} · Invalidation {u.chart.invalidationPrice??"—"}</p>}</details>)}<p className="text-xs leading-5 text-zinc-500">This publishes the saved idea content and already-published linked trades. Private trade data and ASR stay private.</p><label className="flex gap-3 text-xs text-zinc-300"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I have reviewed the idea and its linked trades.</label><div className="flex flex-wrap gap-2"><button type="button" disabled={busy||!confirmed} className={primary} onClick={()=>void run("publish-idea")}>Confirm publication</button><button type="button" disabled={busy} className={button} onClick={()=>setReview(false)}>Cancel</button></div></section>}
  </form>;
}
