import { z } from "zod";

const timestamp = z.string().datetime({ offset: true }).refine(v => Date.parse(v) <= Date.now() + 300000, "Use a non-future date with a timezone");
const price = z.number().finite().positive().max(1e12).nullable();
export const ideaChartSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9]{2,15}USDT$/, "Use a reference market such as BTCUSDT"),
  targetPrice: price, invalidationPrice: price,
}).strict();
export const ideaChartsSchema = z.array(ideaChartSchema).max(12, "Use up to 12 markets").refine(
  charts => new Set(charts.map(chart => chart.symbol)).size === charts.length, "Add each market only once",
);
/** An explicit empty list clears legacy levels; older single-market ideas still work. */
export function ideaChartLevels(idea: { charts?: IdeaChart[]; chart?: IdeaChart }): IdeaChart[] {
  return idea.charts ?? (idea.chart ? [idea.chart] : []);
}
export function ideaMarketLevels(idea: { charts?: IdeaChart[]; chart?: IdeaChart }, symbol: string): IdeaChart | undefined {
  return ideaChartLevels(idea).find(chart => chart.symbol === symbol);
}
export const ideaUpdateSchema = z.object({
  id: z.string().uuid(), at: timestamp, title: z.string().trim().min(1).max(100),
  thesis: z.string().trim().min(1).max(3000), target: z.string().trim().max(1000),
  invalidation: z.string().trim().max(1000), chart: ideaChartSchema.nullable().optional(),
}).strict();
export type IdeaChart = z.infer<typeof ideaChartSchema>;
export type IdeaUpdate = z.infer<typeof ideaUpdateSchema>;
export interface PublishedIdeaUpdate extends IdeaUpdate { publishedAt: string }
