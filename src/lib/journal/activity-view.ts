import type { ActivityGroupFacts, ActivityReview, ActivityStage } from "./activity-schema";
import { articleLinkSchema } from "./activity-schema";

export const actionLabels: Record<string, string> = {
  "open-long": "Open long", "add-long": "Add to long", "trim-long": "Reduce long", "close-long": "Close long",
  "open-short": "Open short", "add-short": "Add to short", "trim-short": "Reduce short", "close-short": "Close short",
  "reverse-long-short": "Reverse long to short", "reverse-short-long": "Reverse short to long", buy: "Buy", sell: "Sell",
};
export const activityDateTime = (at: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at)) + " UTC";

/** Explicit future-public projection. Never spread private group, order or wallet fields into it. */
export function activityPublicDraft(facts: ActivityGroupFacts, review: ActivityReview) {
  const article = (value: string) => {
    if (!value || !articleLinkSchema.safeParse(value).success) return "";
    const url = new URL(value); return `${url.origin}${url.pathname}`;
  };
  const metricLabel = review.metricMode === "wallet-exposure" ? "Exposure change · % of trading wallet equity" : review.metricMode === "spot-weight" ? "Spot weight change · trading wallet" : null;
  return {
    asset: facts.asset, market: facts.market, reason: review.reason, articleUrl: article(review.articleUrl),
    actions: facts.stages.filter(stage => review.stages.find(s => s.id === stage.id)?.include !== false).map(stage => {
      const edit = review.stages.find(s => s.id === stage.id);
      const percentage = review.metricMode === "wallet-exposure" && facts.market === "perp" && !stage.action.startsWith("reverse") ? stage.exposureChangePct : review.metricMode === "spot-weight" && facts.market === "spot" ? stage.spotWeightChangePct : null;
      return { at: stage.at, endAt: stage.endAt, action: actionLabels[stage.action] ?? stage.action, reason: edit?.reason || review.reason || stage.factualReason,
        articleUrl: article(edit?.articleUrl || review.articleUrl), percentage, metricLabel: percentage === null ? null : metricLabel };
    }),
  };
}
export function defaultActivityReview(facts: ActivityGroupFacts): ActivityReview {
  return { status: "pending", grouping: "proposed", reason: facts.factualReason, rationaleConfirmed: false, articleUrl: "", metricMode: "action-only", privateNote: "", stages: [] };
}
export function stageReviewValue(stage: ActivityStage, review: ActivityReview) {
  return review.stages.find(s => s.id === stage.id) ?? { id: stage.id, reason: "", articleUrl: "", include: true };
}

/** Called only by an explicit owner click; preserves reasons, evidence and action edits. */
export function quickActivityReview(review: ActivityReview, decision: "keep" | "exclude"): ActivityReview {
  return decision === "keep"
    ? { ...review, status: "reviewed", grouping: "confirmed", rationaleConfirmed: true }
    : { ...review, status: "excluded" };
}
