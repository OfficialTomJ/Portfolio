"use client";
import { useState, type ReactNode } from "react";
import type { PublicIdeaFields } from "@/lib/performance/workspace-model";
import type { IdeaChart, IdeaUpdate } from "@/lib/performance/idea-timeline-model";
const field="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-zinc-100";
const button="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-4 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40";

function ChartFields({value,onChange,fallbackSymbol=""}:{value?:IdeaChart;onChange:(v:IdeaChart|undefined)=>void;fallbackSymbol?:string}) {
  return <fieldset className="space-y-3 rounded-lg border border-white/10 p-3"><legend className="px-1 text-xs text-zinc-400">Chart levels · optional</legend>
    <label className="flex items-start gap-2 text-xs leading-5 text-zinc-400"><input type="checkbox" className="mt-1" checked={!!value} onChange={e=>onChange(e.target.checked?{symbol:fallbackSymbol,targetPrice:null,invalidationPrice:null}:undefined)}/>Add reference market and manually entered price levels</label>
    {value&&<><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-zinc-400">Reference market<input aria-label="Reference market" required pattern="[A-Z0-9]{2,15}USDT" className={field} placeholder="BTCUSDT" value={value.symbol} onChange={e=>onChange({...value,symbol:e.target.value.toUpperCase()})}/></label>{([ ["targetPrice","Target price"], ["invalidationPrice","Invalidation price"] ] as const).map(([key,label])=><label key={key} className="text-xs text-zinc-400">{label}<input aria-label={label} type="number" min="0" step="any" className={field} value={value[key]??""} onChange={e=>onChange({...value,[key]:e.target.value===""?null:Number(e.target.value)})}/></label>)}</div><p className="text-[11px] leading-5 text-zinc-500">Reference candles use the selected USDT market. Levels are your analysis; prices never imply a trade fill or an automatic target/invalidation decision.</p></>}
  </fieldset>;
}

function UpdateDisclosure({update,index,children}:{update:IdeaUpdate;index:number;children:ReactNode}) {
  const [open,setOpen]=useState(!update.title);
  return <details className="rounded-xl border border-white/10 p-4" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary className="min-h-11 cursor-pointer break-words text-sm text-zinc-300">{index+1}. {update.title||"New timeline update"} · {update.at.slice(0,10)}</summary>{children}</details>;
}

export default function IdeaTimelineEditor({fields,onChange,fallbackSymbol}:{fields:PublicIdeaFields;onChange:(fields:PublicIdeaFields)=>void;fallbackSymbol?:string}) {
  const updates=fields.updates??[];
  const change=(id:string,patch:Partial<IdeaUpdate>)=>onChange({...fields,updates:updates.map(u=>u.id===id?{...u,...patch}:u)});
  return <section className="space-y-4 border-t border-white/10 pt-5" aria-label="Public idea timeline editor">
    <div><h4 className="text-sm font-medium">Chart &amp; idea timeline</h4><p className="mt-2 text-xs leading-5 text-zinc-500">The thesis above is the initial outlook. Add dated updates to show how the idea develops. Each update can carry its own target, invalidation and chart levels. These changes stay in the draft until reviewed and published. Blank target/invalidation text keeps the previous condition; turn chart levels off to clear them for an update.</p></div>
    <ChartFields value={fields.chart} fallbackSymbol={fallbackSymbol} onChange={chart=>onChange({...fields,chart})}/>
    {updates.map((update,index)=><UpdateDisclosure key={update.id} update={update} index={index}><div className="mt-3 space-y-4">
      <label className="block text-xs text-zinc-400">Update title<input required maxLength={100} className={field} value={update.title} onChange={e=>change(update.id,{title:e.target.value})}/></label>
      <label className="block text-xs text-zinc-400">Update date &amp; time · GMT<input required type="datetime-local" className={field} value={update.at.slice(0,16)} onChange={e=>{if(e.target.value)change(update.id,{at:new Date(e.target.value+"Z").toISOString()});}}/></label>
      {([ ["thesis","Updated thesis",3000], ["target","Target / scenario",1000], ["invalidation","Invalidation",1000] ] as const).map(([key,label,max])=><label key={key} className="block text-xs text-zinc-400">{label}<textarea required={key==="thesis"} rows={key==="thesis"?3:2} maxLength={max} className={field} value={update[key]} onChange={e=>change(update.id,{[key]:e.target.value})}/></label>)}
      <ChartFields value={update.chart??undefined} fallbackSymbol={fields.chart?.symbol??fallbackSymbol} onChange={chart=>change(update.id,{chart:chart??null})}/>
      <button type="button" className={button} onClick={()=>{if(window.confirm("Remove this update from the draft? The current public version remains unchanged until publication."))onChange({...fields,updates:updates.filter(u=>u.id!==update.id)});}}>Remove from draft</button>
    </div></UpdateDisclosure>)}
    <button type="button" className={button} disabled={updates.length>=24} onClick={()=>{
      const previous=[...updates].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).reduce((last,u)=>({target:u.target||last.target,invalidation:u.invalidation||last.invalidation,chart:u.chart===null?undefined:u.chart??last.chart}),{target:fields.target,invalidation:fields.invalidation,chart:fields.chart});
      onChange({...fields,updates:[...updates,{id:crypto.randomUUID(),at:new Date().toISOString(),title:"",thesis:"",target:previous.target,invalidation:previous.invalidation,...(previous.chart?{chart:{...previous.chart}}:{})}]});
    }}>Add dated update</button>
    <p className="text-[11px] leading-5 text-zinc-500">{updates.length}/24 updates. Public pages show the stated update date alongside the actual first publication date. Older analysis is never presented as having been public earlier.</p>
  </section>;
}
