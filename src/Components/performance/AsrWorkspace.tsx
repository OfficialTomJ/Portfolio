"use client";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceRow, WorkspaceSnapshot } from "@/lib/performance/workspace-model";
import { completeFacts, publicFacts } from "@/lib/performance/workspace-model";
import type { AsrFields } from "@/lib/performance/asr-model";
import { buildPerformanceView, signedR, sydneyDateKey } from "@/lib/performance/metrics";
import { EMPTY_ANNOTATION, type TradeAnnotation } from "@/lib/performance/annotations-model";
import AsrComparison from "./AsrComparison";
import PrivateReviewChart from "./PrivateReviewChart";

const field="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-zinc-100";
const button="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40";
const reviewed=(r:WorkspaceRow)=>!r.asrStale&&r.edit.expectedR!==null&&r.edit.valid!==null;

export default function AsrWorkspace({initial,initialTrade}:{initial:WorkspaceSnapshot;initialTrade?:string}) {
  const [data,setData]=useState(initial),[selected,setSelected]=useState(initialTrade??""),[search,setSearch]=useState(""),[status,setStatus]=useState("all"),[limit,setLimit]=useState(30),[notice,setNotice]=useState("");
  const dates=data.rows.map(r=>r.edit.facts.closedAt).filter((v):v is string=>!!v).sort();
  const [start,setStart]=useState(dates[0]?sydneyDateKey(dates[0]):sydneyDateKey(data.asOf)),[end,setEnd]=useState(sydneyDateKey(data.asOf));
  const rows=data.rows.filter(r=>{
    const closed=r.edit.facts.closedAt;
    return !!closed&&sydneyDateKey(closed)>=start&&sydneyDateKey(closed)<=end&&`${r.edit.facts.symbol} ${r.id}`.toLowerCase().includes(search.toLowerCase())&&(status==="all"||status==="reviewed"&&reviewed(r)||status==="pending"&&!reviewed(r));
  });
  const eligible=rows.filter(r=>!r.archived&&!r.duplicateOf&&!r.sourceChanged&&r.edit.inclusion==="included"&&completeFacts(r.edit.facts));
  const annotations:Record<string,TradeAnnotation>=Object.fromEntries(eligible.map(r=>[r.id,{...EMPTY_ANNOTATION,...r.edit,...(r.asrStale?{expectedR:null,valid:null}:{})}]));
  const dataset={id:"private-asr",label:"Private ASR",description:"Private closed trade reviews",inceptionAt:dates[0]??data.asOf,asOf:data.asOf,trades:eligible.map(r=>publicFacts(r.id,r.source,r.edit))};
  const view=buildPerformanceView(dataset,"CUSTOM",Number(end.slice(0,4)),{start,end});
  const row=data.rows.find(r=>r.id===selected);
  return <div className="space-y-5">
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#09090b] p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-zinc-400">Find a trade<input className={field} placeholder="Asset or trade ID…" value={search} onChange={e=>{setSearch(e.target.value);setLimit(30);}}/></label>
      <label className="text-xs text-zinc-400">Review status<select className={field} value={status} onChange={e=>{setStatus(e.target.value);setLimit(30);}}><option value="all">All closed trades</option><option value="pending">Needs ASR</option><option value="reviewed">Reviewed</option></select></label>
      <label className="text-xs text-zinc-400">From<input type="date" className={field} value={start} max={end} onChange={e=>setStart(e.target.value)}/></label>
      <label className="text-xs text-zinc-400">To<input type="date" className={field} value={end} min={start} max={sydneyDateKey(data.asOf)} onChange={e=>setEnd(e.target.value)}/></label>
    </div><p className="text-xs leading-5 text-zinc-500">Private assessments only. Saving ASR never publishes a trade, changes realised R or creates a public draft. Archived, held, excluded and duplicate records can be reviewed but stay outside comparison totals.</p></section>
    {notice&&<p role="status" className="text-sm text-[#ffad83]">{notice}</p>}
    <AsrComparison view={view} annotations={annotations} initialMode="asr"/>
    <section aria-label="Private ASR trade list" className="overflow-hidden rounded-2xl border border-white/10 bg-[#09090b]">
      <header className="p-5"><h2 className="text-lg">Trade reviews</h2><p className="mt-1 text-xs text-zinc-500">{rows.length} closed trades in selection · {rows.filter(reviewed).length} reviewed</p></header>
      {rows.slice(0,limit).map(r=><article key={r.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[.07] p-4 sm:p-5"><div className="min-w-0"><p className="text-sm text-zinc-200">{r.edit.facts.symbol} · {r.edit.facts.direction}</p><p className="mt-1 text-xs text-zinc-500">{sydneyDateKey(r.edit.facts.closedAt!)} · {r.asrStale?"Facts changed · review again":reviewed(r)?"Reviewed":"Needs ASR"}{r.archived?" · archived":""}</p></div><div className="flex flex-wrap items-center gap-4"><p className="text-xs text-zinc-400">Actual <span className="text-zinc-200">{r.edit.facts.resultR===null?"—":signedR(r.edit.facts.resultR)}</span><span className="ml-3">Expected {r.edit.expectedR===null?"—":signedR(r.edit.expectedR)}</span></p><button type="button" className={button} onClick={()=>setSelected(r.id)}>Review ASR</button></div></article>)}
      {!rows.length&&<p className="p-8 text-center text-sm text-zinc-500">No closed trades match these filters.</p>}
      {rows.length>limit&&<button type="button" className={`${button} m-4`} onClick={()=>setLimit(limit+30)}>Show more reviews</button>}
    </section>
    {row&&<AsrEditor key={`${row.id}:${row.asrRevision??0}`} row={row} close={()=>setSelected("")} onSaved={next=>{setData(next);setSelected("");setNotice("ASR saved privately. Public results and publication drafts are unchanged.");}}/>}
  </div>;
}

function AsrEditor({row,close,onSaved}:{row:WorkspaceRow;close:()=>void;onSaved:(data:WorkspaceSnapshot)=>void}) {
  const initial={expectedR:row.edit.expectedR,valid:row.edit.valid,asrComments:row.edit.asrComments};
  const [fields,setFields]=useState<AsrFields>(initial),[busy,setBusy]=useState(false),[error,setError]=useState(""),[chartOpen,setChartOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),dirty=JSON.stringify(fields)!==JSON.stringify(initial);
  const [trade]=useState(()=>completeFacts(row.edit.facts)?publicFacts(row.id,row.source,row.edit):null);
  useEffect(()=>{const node=dialog.current;node?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{node?.close();document.body.style.overflow=overflow;};},[]);
  useEffect(()=>{if(!dirty)return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler);},[dirty]);
  const dismiss=()=>{if(!busy&&(!dirty||window.confirm("Discard unsaved ASR changes?")))close();};
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/performance/admin/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save-asr",id:row.id,revision:row.asrRevision??0,requestId:crypto.randomUUID(),fields})});const body=await response.json();if(!response.ok)throw Error(body.error);onSaved(body);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <dialog ref={dialog} aria-labelledby="asr-title" onCancel={e=>{e.preventDefault();dismiss();}} className="m-auto h-[100dvh] max-h-[100dvh] w-full max-w-5xl overflow-hidden border border-white/15 bg-[#09090b] p-0 text-zinc-100 backdrop:bg-black/80 sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl"><form onSubmit={save} className="flex max-h-[100dvh] flex-col sm:max-h-[92dvh]">
    <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5"><div><p className="text-[10px] uppercase tracking-widest text-[#ffad83]">Private · Advanced Self Review</p><h2 id="asr-title" className="mt-2 text-xl">{row.edit.facts.symbol} · {row.edit.facts.direction}</h2><p className="mt-2 text-xs text-zinc-500">Actual net R: {row.edit.facts.resultR===null?"Needs reconciliation":signedR(row.edit.facts.resultR)} · Review revision {row.asrRevision??0}</p></div><button type="button" aria-label="Close ASR editor" className={button} disabled={busy} onClick={dismiss}>×</button></header>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      {row.asrStale&&<p className="rounded-lg border border-amber-300/20 p-3 text-xs leading-5 text-amber-100">Trade facts or risk changed after this ASR. Your previous assessment is retained but excluded from reviewed comparisons until you review and save again.</p>}
      {trade&&<details onToggle={e=>setChartOpen(e.currentTarget.open)}><summary className="min-h-11 cursor-pointer text-sm text-zinc-400">Trade chart · reference prices</summary>{chartOpen&&<PrivateReviewChart trade={trade}/>}</details>}
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-zinc-400">Expected R<input aria-label="Expected R" type="number" min="-100" max="100" step="any" className={field} value={fields.expectedR??""} onChange={e=>setFields(f=>({...f,expectedR:e.target.value===""?null:Number(e.target.value)}))}/></label><label className="text-xs text-zinc-400">Trade validity<select className={field} value={fields.valid===null?"":String(fields.valid)} onChange={e=>setFields(f=>({...f,valid:e.target.value===""?null:e.target.value==="true"}))}><option value="">Not reviewed</option><option value="true">Valid</option><option value="false">Invalid</option></select></label></div>
      <label className="block text-xs text-zinc-400">ASR comments · Private<textarea rows={6} maxLength={10000} className={field} value={fields.asrComments} onChange={e=>setFields(f=>({...f,asrComments:e.target.value}))}/></label>
      {row.edit.privateNotes&&<details><summary className="min-h-11 cursor-pointer text-xs text-zinc-500">Private reconciliation notes</summary><p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">{row.edit.privateNotes}</p></details>}
      <p className="text-xs leading-5 text-zinc-500">Expected R and validity are required for a completed review. A partial review can be saved. These fields and comments never appear publicly.</p>
      {error&&<p role="alert" className="text-sm text-rose-300">{error} Your unsaved review remains here.</p>}
    </div><footer className="flex flex-wrap gap-3 border-t border-white/10 p-4 sm:p-5"><button type="submit" disabled={(!dirty&&!row.asrStale)||busy} className={`${button} border-[#ff6719]/40 bg-[#ff6719]/10 !text-[#ffad83]`}>{busy?"Saving…":"Save private ASR"}</button><button type="button" className={button} disabled={busy} onClick={dismiss}>Close</button></footer>
  </form></dialog>;
}
