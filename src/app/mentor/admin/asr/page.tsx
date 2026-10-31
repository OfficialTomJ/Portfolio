import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { getWorkspace } from "@/lib/performance/workspace-store";
import AsrWorkspace from "@/Components/performance/AsrWorkspace";
export const dynamic="force-dynamic";
export const metadata={title:"Private ASR | Admin",robots:{index:false,follow:false}};
export default async function AsrPage({searchParams}:{searchParams:Promise<{trade?:string}>}) {
  if(!await getPerformanceAdminSession())notFound();
  const [workspace,query]=await Promise.all([getWorkspace(),searchParams]);
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6 sm:py-10"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-widest text-[#ffad83]">Private review</p><h1 className="mt-2 text-3xl font-medium">Advanced Self Review</h1><p className="mt-2 text-sm text-zinc-500">Assess the process and compare actual vs expected R.</p></div><Link href="/admin" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-4 text-xs text-zinc-300">← Imports, reconciliation &amp; publishing</Link></header><AsrWorkspace initial={workspace} initialTrade={query.trade}/></main>;
}
