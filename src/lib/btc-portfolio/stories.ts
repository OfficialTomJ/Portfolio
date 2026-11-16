import { z } from "zod";
import type { ActivityGroupFacts, ActivityReview } from "@/lib/journal/activity-schema";

const at = z.iso.datetime({ offset: true });
const publicCopy = z.string().trim().min(1).max(600).refine(value => !/(?:\$\s*\d|\b\d[\d,.]*\s*(?:USD[TC]?|AUD|BTC|XBT|ETH|SOL|HYPE|FARTCOIN|sats?|dollars?)\b|\b0x[a-f0-9]{40}\b)/i.test(value), "Keep private financial details out of idea copy.");
const articleUrl = z.string().max(700).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash && url.hostname.endsWith(".substack.com") && /^\/p\/[^/]+\/?$/.test(url.pathname); } catch { return false; }
});
const editorialPeriod = z.string().regex(/^20\d{2}(?:-(?:0[1-9]|1[0-2]))?$/);
/** Owner-authored commentary has no execution timestamp, direction, size or source-trade linkage. */
export const portfolioEditorialNoteSchema = z.object({
  id: z.string().regex(/^note-[a-f0-9]{16}$/), asset: z.string().regex(/^[a-zA-Z0-9]{1,20}$/),
  period: editorialPeriod, periodEnd: editorialPeriod.optional(), title: publicCopy, reason: publicCopy,
  detail: publicCopy.optional(),
  pinned: z.boolean().optional(),
  articleUrl: articleUrl.default(""),
}).strict().superRefine((value, ctx) => {
  if (value.periodEnd && (value.period.length !== value.periodEnd.length || value.periodEnd < value.period)) ctx.addIssue({ code: "custom", message: "Editorial periods must be ordered and use the same precision." });
});
export type PortfolioEditorialNote = z.infer<typeof portfolioEditorialNoteSchema>;
export const portfolioIdeaSchema = z.object({
  id: z.string().regex(/^idea-[a-f0-9]{16}$/), asset: z.string().regex(/^[a-zA-Z0-9]{1,20}$/),
  direction: z.enum(["LONG", "SHORT", "SPOT"]), at, endAt: at, title: publicCopy, reason: publicCopy,
  articleUrl, articleStatus: z.enum(["published", "awaiting-publication"]),
}).strict().superRefine((value, ctx) => {
  if ((value.articleStatus === "published") !== Boolean(value.articleUrl)) ctx.addIssue({ code: "custom", message: "Only verified published articles may have a public link." });
});
export const portfolioPerpTradeSchema = z.object({
  id: z.string().regex(/^perp-[a-f0-9]{16}$/), asset: z.string().regex(/^[a-zA-Z0-9]{1,20}$/),
  direction: z.enum(["LONG", "SHORT"]), openedAt: at.nullable(), closedAt: at.nullable(),
}).strict().superRefine((value, ctx) => {
  if (!value.openedAt && !value.closedAt) ctx.addIssue({ code: "custom", message: "A trade requires a known opening or closing date." });
  if (value.openedAt && value.closedAt && Date.parse(value.closedAt) < Date.parse(value.openedAt)) ctx.addIssue({ code: "custom", message: "Trade dates must be ordered." });
});
export const portfolioStoriesSchema = z.object({
  version: z.literal(1), status: z.literal("localhost-preview"), preparedAt: at,
  ideas: z.array(portfolioIdeaSchema).max(1000), perpTrades: z.array(portfolioPerpTradeSchema).max(10000),
  pendingPerformanceYears: z.array(z.number().int().min(2009).max(2100)).max(20),
}).strict();
export type PortfolioIdea = z.infer<typeof portfolioIdeaSchema>;
export type PortfolioPerpTrade = z.infer<typeof portfolioPerpTradeSchema>;
export type PortfolioStories = z.infer<typeof portfolioStoriesSchema>;

/** No balances, exposures, execution prices, exchange IDs or private references cross this boundary. */
export function projectIdea(facts: ActivityGroupFacts, review: ActivityReview, id: string, title: string): PortfolioIdea | null {
  if (facts.market === "context" || review.status !== "reviewed" || !review.rationaleConfirmed || review.grouping !== "confirmed" || review.research?.basis !== "direct") return null;
  const sources = review.research.sources.filter(source => source.relationship === "direct");
  if (!sources.length) return null;
  const published = sources.find(source => source.status === "published" && articleUrl.safeParse(source.articleUrl).success && source.articleUrl);
  const source = published ?? sources[0];
  return portfolioIdeaSchema.parse({ id, asset: facts.asset, at: facts.at, endAt: facts.endAt, title, reason: review.reason,
    direction: facts.market === "spot" ? "SPOT" : facts.stages[0]?.action.includes("short") ? "SHORT" : "LONG",
    articleStatus: published ? "published" : "awaiting-publication", articleUrl: published ? source.articleUrl : "",
  });
}

/** Split reversals into directional trades; missing carried-in entry dates remain unknown. */
export function projectPerpTrades(facts: ActivityGroupFacts, makeId: (index: number) => string): PortfolioPerpTrade[] {
  if (facts.market !== "perp" || /^(?:PAXG|XAUT|GOLD|SILVER|XAU|XAG|CL|OIL|WTI|BRENT)$/i.test(facts.asset)) return [];
  const rows: PortfolioPerpTrade[] = [];
  let current: { direction: "LONG" | "SHORT"; openedAt: string | null } | null = null;
  const finish = (closedAt: string | null) => {
    if (!current) return;
    rows.push(portfolioPerpTradeSchema.parse({ id: makeId(rows.length), asset: facts.asset, ...current, closedAt })); current = null;
  };
  for (const stage of facts.stages) {
    if (stage.action.startsWith("reverse-")) {
      const from = stage.action === "reverse-long-short" ? "LONG" : "SHORT";
      current ??= { direction: from, openedAt: null }; finish(stage.at);
      current = { direction: from === "LONG" ? "SHORT" : "LONG", openedAt: stage.at };
    } else {
      const direction = stage.action.includes("short") ? "SHORT" : "LONG";
      current ??= { direction, openedAt: stage.action.startsWith("open-") ? stage.at : null };
      if (stage.action.startsWith("close-")) finish(stage.endAt);
    }
  }
  if (current) finish(null);
  return rows;
}
