import { z } from "zod";
import { publicSchema, type PublicPortfolio } from "./schema";

const at = z.iso.datetime({ offset: true });
const index = z.number().finite().positive();
const point = z.object({ at, portfolioIndex: index, btcIndex: index }).strict();

/** Explicitly approved chart projection, kept separate from private source and review collections. */
export const localChartHistorySchema = z.object({
  version: z.literal(1), status: z.literal("approved-localhost"),
  historical: z.array(point).min(2).max(4000),
  bridge: z.array(z.object({ at, btcIndex: index }).strict()).max(400),
  currentInceptionAt: at, currentBtcIndexAtInception: index,
}).strict();
export type LocalChartHistory = z.infer<typeof localChartHistorySchema>;

/** Preserve the daily path and current allocation; link returns rather than adding percentages. */
export function combinePortfolioHistory(current: PublicPortfolio, input: LocalChartHistory): PublicPortfolio {
  const history = localChartHistorySchema.parse(input);
  const opening = current.points[0], terminal = history.historical.at(-1)!;
  if (current.currency !== "USD" || !opening || opening.at !== history.currentInceptionAt || current.inceptionAt !== opening.at || current.history)
    throw new Error("History must link to the original USD current-period series.");
  const initial = history.historical[0];
  if (Math.abs(initial.portfolioIndex - 100) > 1e-8 || Math.abs(initial.btcIndex - 100) > 1e-8)
    throw new Error("Historical series must start at 100.");
  const points = [
    ...history.historical.map(p => ({ ...p, weights: {} })),
    ...history.bridge.map(p => ({ ...p, portfolioIndex: terminal.portfolioIndex, weights: {} })),
    ...current.points.map(p => ({ ...p,
      portfolioIndex: terminal.portfolioIndex * p.portfolioIndex / opening.portfolioIndex,
      btcIndex: history.currentBtcIndexAtInception * p.btcIndex / opening.btcIndex,
    })),
  ];
  for (let i = 1; i < points.length; i++) if (Date.parse(points[i].at) <= Date.parse(points[i - 1].at))
    throw new Error("Linked history must have unique, increasing dates with no overlap.");
  return publicSchema.parse({ ...current, inceptionAt: initial.at, points,
    history: { method: "linked-performance", priorAsOf: terminal.at, currentInceptionAt: opening.at, cashBridgeAssumed: true },
  });
}
