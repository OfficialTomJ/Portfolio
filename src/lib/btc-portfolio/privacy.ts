import { publicSchema, type PublicPortfolio } from "./schema";

/** A reduction of matching signals, not an anonymity guarantee or permission to publish. */
export function withholdWalletHistory(input: PublicPortfolio, options: { walletCurveApproved?: boolean } = {}): PublicPortfolio {
  if (input.history && !options.walletCurveApproved) throw new Error("Unlink wallet history before preparing the visitor projection.");
  const { stories, performanceCoverage: _coverage, editorialNotes: _notes, ...base } = input;
  void _coverage; void _notes;
  return publicSchema.parse({ ...base, activity: [], campaigns: [],
    points: input.points.map(({ at, portfolioIndex, btcIndex }) => ({ at, portfolioIndex, btcIndex, weights: {} })),
    stories: stories ? { ...stories, ideas: [], perpTrades: [] } : undefined,
    privacy: { publication: options.walletCurveApproved ? "localhost-preview" : "held-for-review", walletHistory: input.history ? "curve-only" : "withheld", tradeRecords: "private-only", tradeLinkedIdeas: "private-only" },
  });
}
