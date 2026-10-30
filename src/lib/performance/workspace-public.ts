import "server-only";
import { getDb } from "@/lib/mongodb";
import type { PerformanceTrade } from "./types";
import type { PublicIdea } from "./workspace-model";

export const PUBLIC_EDITS = "performance_published_reconciliations";
export const PUBLIC_IDEAS = "performance_published_ideas";
export const PUBLIC_ASSIGNMENTS = "performance_published_idea_assignments";
export interface PublicAssignment { _id:string; ideaId:string|null; origin:"idea"|"trade" }
export interface PublicEditDocument { _id: string; revision: number; trade: PerformanceTrade | null; inclusion: "included" | "held" | "excluded"; ideaId: string | null; updatedAt: string }
export async function publishedEdits(): Promise<Map<string, PublicEditDocument>> {
  const docs = await getDb().collection<PublicEditDocument>(PUBLIC_EDITS).find({}).toArray();
  return new Map(docs.map(d => [d._id, d]));
}
export function applyPublishedEdits(trades: PerformanceTrade[], edits: Map<string, PublicEditDocument>): PerformanceTrade[] {
  return trades.flatMap(t => { const e = edits.get(t.id); return !e ? [t] : e.inclusion === "included" && e.trade ? [e.trade] : []; });
}
/** The public loader never reads private idea content or assignments. */
export async function getPublicIdeas(): Promise<PublicIdea[]> {
  const docs = await getDb().collection<PublicIdea & { _id: string }>(PUBLIC_IDEAS).find({}).sort({ updatedAt: -1 }).toArray();
  return docs.map(d => ({ id: d.id, title: d.title, thesis: d.thesis, target: d.target, invalidation: d.invalidation,
    status: d.status, ideaAt: d.ideaAt, articleUrl: d.articleUrl, firstPublishedAt: d.firstPublishedAt, updatedAt: d.updatedAt, tradeIds: d.tradeIds }));
}
export async function publicIdeaTrades(idea: PublicIdea, trades: PerformanceTrade[]) {
  return (await getPublicIdeaViews(trades)).find(i=>i.id===idea.id)?.trades??[];
}
export async function getPublicIdeaViews(trades:PerformanceTrade[]) {
  const [ideas,edits,assignmentDocs]=await Promise.all([getPublicIdeas(),publishedEdits(),getDb().collection<PublicAssignment>(PUBLIC_ASSIGNMENTS).find({}).toArray()]);
  const assignments=new Map(assignmentDocs.map(a=>[a._id,a.ideaId]));
  const fallback=new Map<string,string>();
  for(const idea of [...ideas].sort((a,b)=>a.firstPublishedAt.localeCompare(b.firstPublishedAt)||a.id.localeCompare(b.id)))for(const id of idea.tradeIds)fallback.set(id,idea.id);
  return ideas.map(idea=>{
    const linked=trades.filter(t=>(assignments.has(t.id)?assignments.get(t.id):edits.has(t.id)?edits.get(t.id)!.ideaId:fallback.get(t.id))===idea.id);
    return {...idea,tradeIds:linked.map(t=>t.id),trades:linked};
  });
}
