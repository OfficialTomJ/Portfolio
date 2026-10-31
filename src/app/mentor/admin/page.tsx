import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JournalWorkspace from "@/Components/performance/JournalWorkspace";
import AdminImportControl from "@/Components/performance/AdminImportControl";
import PerformanceUnavailable from "@/Components/performance/PerformanceUnavailable";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { getWorkspace } from "@/lib/performance/workspace-store";
import { getDb } from "@/lib/mongodb";
import { readBreakoutAccount, readImportHistory } from "@/lib/performance/breakout-store";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Journal workspace | Admin",robots:{index:false,follow:false}};
export default async function ReviewPage({searchParams}:{searchParams:Promise<{view?:string;trade?:string;idea?:string}>}) {
  if(!await getPerformanceAdminSession())notFound();
  const query=await searchParams; const view=query.view;
  const [workspace,account,imports]=await Promise.all([getWorkspace().catch(()=>null),readBreakoutAccount(getDb()).catch(()=>null),readImportHistory(getDb()).catch(()=>[])]);
  return <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pt-9"><header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.18em] text-[#ff8b52]">Private workspace</p><h1 className="mt-2 text-2xl font-medium tracking-tight text-zinc-100 sm:text-3xl">Performance Journal</h1></div><nav aria-label="Private admin pages" className="flex flex-wrap gap-2"><Link href="/admin/asr" className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-4 text-xs text-zinc-300">Private ASR →</Link><Link href="/admin/overview" className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-4 text-xs text-zinc-300">Creator overview</Link><Link href="/performance" target="_blank" className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-4 text-xs text-zinc-300">View public journal ↗</Link></nav></header>
  {workspace?<JournalWorkspace key={query.trade??query.idea??"workspace"} initialSelected={query.trade??null} initialIdea={query.idea??null} initial={workspace} initialView={query.trade||view==="trades"?"trades":view==="imports"?"imports":view==="history"?"history":"ideas"} imports={<AdminImportControl account={account?{historyFrom:account.historyFrom,historyThrough:account.historyThrough,lastImportedAt:account.lastImportedAt.toISOString(),importRevision:account.importRevision,active:!!account.activatedAt&&(account.activatedFrom??account.historyFrom)===account.historyFrom}:null} imports={imports}/>}/>:<PerformanceUnavailable title="Private workspace is temporarily unavailable."/>}</main>;
}
