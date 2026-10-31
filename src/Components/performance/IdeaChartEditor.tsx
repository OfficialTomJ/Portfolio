"use client";
import type { IdeaChart } from "@/lib/performance/idea-timeline-model";
const field="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-zinc-100";
const button="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-3 text-xs text-zinc-300 hover:bg-white/5";

export default function IdeaChartEditor({value,onChange,fallbackSymbol=""}:{value:IdeaChart[];onChange:(v:IdeaChart[])=>void;fallbackSymbol?:string}) {
  const update=(index:number,patch:Partial<IdeaChart>)=>onChange(value.map((chart,i)=>i===index?{...chart,...patch}:chart));
  return <fieldset className="space-y-4" aria-label="Market chart levels">
    {value.map((chart,index)=><fieldset key={index} className="min-w-0 rounded-lg border border-white/10 p-3"><legend className="px-1 text-xs text-zinc-500">Market {index+1}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="min-w-0 text-xs text-zinc-400">Ticker<input aria-label={`Market ${index+1} ticker`} required pattern="[A-Z0-9]{2,15}USDT" className={field} placeholder="BTCUSDT" value={chart.symbol} onChange={e=>update(index,{symbol:e.target.value.toUpperCase().replace(/\s/g,"")})} onBlur={()=>{if(chart.symbol&&!chart.symbol.endsWith("USDT"))update(index,{symbol:`${chart.symbol}USDT`});}}/></label>
        {([ ["targetPrice","Target price"], ["invalidationPrice","Invalidation price"] ] as const).map(([key,label])=><label key={key} className="min-w-0 text-xs text-zinc-400">{label}<input aria-label={`Market ${index+1} ${label.toLowerCase()}`} type="number" min="0" step="any" className={field} value={chart[key]??""} onChange={e=>update(index,{[key]:e.target.value===""?null:Number(e.target.value)})}/></label>)}
      </div><button type="button" aria-label={`Remove market ${index+1}`} className="mt-2 min-h-11 text-xs text-zinc-500 hover:text-rose-300" onClick={()=>onChange(value.filter((_,i)=>i!==index))}>Remove market</button>
    </fieldset>)}
    <button type="button" disabled={value.length>=12} className={`${button} disabled:opacity-40`} onClick={()=>onChange([...value,{symbol:value.length?"":fallbackSymbol,targetPrice:null,invalidationPrice:null}])}>+ Add market</button>
  </fieldset>;
}
