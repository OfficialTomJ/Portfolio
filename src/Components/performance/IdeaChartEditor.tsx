"use client";
import type { IdeaChart } from "@/lib/performance/idea-timeline-model";
const field="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-zinc-100";

export default function IdeaChartEditor({value,onChange,fallbackSymbol=""}:{value?:IdeaChart;onChange:(v:IdeaChart|undefined)=>void;fallbackSymbol?:string}) {
  return <fieldset className="space-y-3 rounded-lg border border-white/10 p-3"><legend className="px-1 text-xs text-zinc-400">Chart levels · optional</legend>
    <label className="flex items-start gap-2 text-xs leading-5 text-zinc-400"><input type="checkbox" className="mt-1" checked={!!value} onChange={e=>onChange(e.target.checked?{symbol:fallbackSymbol,targetPrice:null,invalidationPrice:null}:undefined)}/>Add reference market and manually entered price levels</label>
    {value&&<><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-zinc-400">Reference market<input aria-label="Reference market" required pattern="[A-Z0-9]{2,15}USDT" className={field} placeholder="BTCUSDT" value={value.symbol} onChange={e=>onChange({...value,symbol:e.target.value.toUpperCase()})}/></label>{([ ["targetPrice","Target price"], ["invalidationPrice","Invalidation price"] ] as const).map(([key,label])=><label key={key} className="text-xs text-zinc-400">{label}<input aria-label={label} type="number" min="0" step="any" className={field} value={value[key]??""} onChange={e=>onChange({...value,[key]:e.target.value===""?null:Number(e.target.value)})}/></label>)}</div><p className="text-[11px] leading-5 text-zinc-500">Reference candles use the selected USDT market. Levels are your analysis; prices never imply a trade fill or an automatic target/invalidation decision.</p></>}
  </fieldset>;
}
