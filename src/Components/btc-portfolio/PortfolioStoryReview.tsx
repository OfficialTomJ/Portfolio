import type { loadPortfolioStoryAdmin } from "@/lib/btc-portfolio/story-admin";
import PortfolioIdeas from "./PortfolioIdeas";
import PortfolioPerpTrades from "./PortfolioPerpTrades";

export default function PortfolioStoryReview({ review }: { review: NonNullable<Awaited<ReturnType<typeof loadPortfolioStoryAdmin>>> }) {
  const { data, references, notes } = review;
  const linkedNotes = notes.filter(note => note.period.startsWith("2025") && note.articleUrl).length;
  const linkedCandidates = data.ideas.filter(idea => idea.articleStatus === "published").length;
  return <section className="space-y-6">
    <div className="rounded-xl border border-[#ff8b52]/20 bg-[#ff8b52]/[.025] p-5 text-xs leading-6 text-zinc-400"><h2 className="text-lg text-zinc-200">Ideas to publish</h2><p className="mt-3">The editorial notes below are the visitor preview. Selected research summaries link to published articles; original execution-linked candidates and source records remain in the private sections below. Allocation-change history is retired.</p><p className="mt-2 text-zinc-500">{linkedNotes} linked 2025 summaries · {linkedCandidates} accepted candidates with published research · Nothing deployed to production</p></div>
    <PortfolioIdeas ideas={[]} notes={notes} historicalYear={2025} initialYear="2025"/>
    {review.linkReviewIssues.length > 0 && <aside aria-label="Private reconciliation notes" className="rounded-xl border border-amber-200/15 bg-amber-200/[.025] p-5 text-xs leading-6 text-zinc-400"><h3 className="font-medium text-amber-100/80">Private reconciliation note</h3>{review.linkReviewIssues.map(issue => <p key={issue} className="mt-2">{issue}</p>)}</aside>}
    <details className="rounded-xl border border-white/10 p-5 text-xs text-zinc-400"><summary className="min-h-11 cursor-pointer">Private execution-linked candidates · {data.ideas.length}</summary><div className="mt-4"><PortfolioIdeas ideas={data.ideas} initialYear="2025" headingId="private-portfolio-ideas-title"/></div></details>
    <details className="rounded-xl border border-white/10 p-5 text-xs text-zinc-400"><summary className="min-h-9 cursor-pointer">Private Substack references</summary><div className="mt-4 space-y-5">{data.ideas.map(idea => <div className="border-t border-white/10 pt-4" key={idea.id}><p className="font-medium text-zinc-200">{idea.asset} · {idea.title}</p><div className="mt-2 flex flex-col items-start gap-1">{references.find(r => r.id === idea.id)?.sources.filter(source => source.relationship === "direct").map(source => <a key={source.url} href={source.status === "published" && source.articleUrl ? source.articleUrl : source.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[#ffad83]">{source.title} ↗ <span className="ml-2 text-[10px] text-zinc-500">{source.status === "draft" ? "Unpublished · private editor" : "Published"}</span></a>)}</div></div>)}</div></details>
    <div className="border-t border-white/10 pt-6"><h2 className="mb-3 text-lg text-zinc-200">Perp trade records</h2><p className="mb-5 text-xs leading-6 text-zinc-500">Private review only. Reversals are separated into long and short trades; missing entry dates remain unknown. No trade list appears on the visitor portfolio.</p><PortfolioPerpTrades trades={data.perpTrades}/></div>
  </section>;
}
