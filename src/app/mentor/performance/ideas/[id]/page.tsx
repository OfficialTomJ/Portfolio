import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLivePerformanceDataset } from "@/lib/performance/data";
import { getPublicIdeaViews } from "@/lib/performance/workspace-public";
import { getStagingIdeaExampleTrades } from "@/lib/performance/staging-idea-example-store";
import PublicIdeaDetail from "@/Components/performance/PublicIdeaDetail";
export const dynamic="force-dynamic";
type Props={params:Promise<{id:string}>};
const load=cache(async(id:string)=>{
  if(!/^idea-[a-f0-9-]{36}$/.test(id))return null;
  const result=await getLivePerformanceDataset();
  if(result.status!=="available")return null;
  return (await getPublicIdeaViews(result.dataset.trades)).find(i=>i.id===id)??null;
});
export async function generateMetadata({params}:Props){const idea=await load((await params).id);return idea?{title:`${idea.title} | Trading ideas`,description:idea.thesis.slice(0,180),alternates:{canonical:`https://mentor.thomas-johnston.com/performance/ideas/${idea.id}`}}:{title:"Idea unavailable"};}
export default async function IdeaPage({params}:Props){
  const idea=await load((await params).id);if(!idea)notFound();
  const exampleTrades=await getStagingIdeaExampleTrades(idea.id);
  const date=(v:string)=>new Date(v).toLocaleDateString("en-AU",{timeZone:"Australia/Sydney",day:"numeric",month:"short",year:"numeric"});
  return <main className="mx-auto max-w-7xl space-y-5 px-4 pb-12 pt-5 sm:px-6 sm:pt-8"><Link href="/performance" className="inline-flex min-h-11 items-center text-xs text-zinc-500 hover:text-white">← Performance Journal</Link><header className="border-b border-white/10 pb-4"><p className="text-[10px] uppercase tracking-[.18em] text-[#ff8b52]">Trading idea · {idea.status}</p><h1 className="mt-3 break-words text-xl font-medium tracking-tight text-zinc-100 sm:text-2xl">{idea.title}</h1><p className="mt-3 text-[11px] leading-5 text-zinc-500">Idea dated {date(idea.ideaAt)} · First published {date(idea.firstPublishedAt)} · Updated {date(idea.updatedAt)}</p></header><PublicIdeaDetail idea={idea} exampleTrades={exampleTrades}/></main>;
}
