import type { PublicIdeaFields, WorkspaceRow } from "@/lib/performance/workspace-model";

export default function IdeaReadiness({fields,rows}:{fields:PublicIdeaFields;rows:WorkspaceRow[]}) {
  const markets=[...new Set(rows.map(r=>r.edit.facts.symbol))];
  const earlierTrade=rows.some(r=>Date.parse(r.edit.facts.openedAt)<Date.parse(fields.ideaAt));
  return <aside className="space-y-3 rounded-xl border border-white/10 bg-white/[.015] p-4" aria-label="Idea publication readiness"><h4 className="text-sm text-zinc-300">From rough notes to a public idea</h4><p className="text-xs leading-5 text-zinc-500">Keep the working version brief. Before publishing, add enough context for a reader who does not know your setup shorthand.</p><ul className="space-y-2 text-xs text-zinc-400">{[["Thesis",!!fields.thesis.trim()],["Target / scenario",!!fields.target.trim()],["Invalidation condition",!!fields.invalidation.trim()]].map(([label,ready])=><li key={String(label)}><span className={ready?"text-[#ffad83]":"text-zinc-600"}>{ready?"✓":"○"}</span> {label}{!ready&&" · needed before publication"}</li>)}</ul>
    <p className="text-[11px] leading-5 text-zinc-500">Useful context: market, direction, timeframe, what confirms the setup, and whether invalidation means a touch, a candle close or a structural change. Numeric chart levels are optional.</p>
    {earlierTrade&&<p className="text-xs leading-5 text-amber-200/80">Some assigned trades predate the stated idea date. Check the date: recording rough notes later does not make them a live call. The public page keeps first publication separate.</p>}
    {markets.length>1&&<p className="text-xs leading-5 text-amber-200/80">This idea spans {markets.join(", ")}. State which market each target and invalidation belongs to. A BTC price level must not be reused on an ETH or SOL chart.</p>}
  </aside>;
}
