"use client";
import { useEffect, useRef } from "react";
import { JOURNAL_DISCORD_URL } from "@/lib/performance/community";
import { track } from "@/lib/track";
export default function DiscordCTA({ placement="after_results" }:{placement?:string}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{ const node=ref.current;if(!node)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){track("performance_cta_view",{placement});observer.disconnect();}},{threshold:.5});observer.observe(node);return()=>observer.disconnect();},[placement]);
  return <div ref={ref} className="flex flex-col items-center justify-between gap-3 border-t border-white/[.07] bg-white/[.015] px-4 py-4 sm:flex-row sm:px-6"><p className="text-center text-xs leading-5 text-zinc-400 sm:text-left">Follow the ideas behind the results.<span className="hidden sm:inline"> Charts, context and conversation.</span></p><a href={JOURNAL_DISCORD_URL} target="_blank" rel="noreferrer" onClick={()=>track("performance_cta_click",{channel:"discord",placement})} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-5 rounded-lg bg-[#ff6719] px-6 text-sm font-medium text-black hover:bg-[#ff884a]">Join Discord <span aria-hidden>↗</span></a></div>;
}
