import test from "node:test";
import assert from "node:assert/strict";
import { projectIdea, projectPerpTrades, portfolioStoriesSchema, portfolioEditorialNoteSchema } from "./stories";
import { defaultActivityReview } from "@/lib/journal/activity-view";
import type { ActivityGroupFacts, ActivityStage } from "@/lib/journal/activity-schema";
const at = "2025-03-01T00:00:00.000Z", endAt = "2025-03-03T00:00:00.000Z";
const stage = (action: string, time: string): ActivityStage => ({ action, at: time, endAt: time } as ActivityStage);
const group = (extra: Partial<ActivityGroupFacts> = {}): ActivityGroupFacts => ({ id: "PRIVATE_GROUP_ID", year: 2025, kind: "position", asset: "BTC", market: "perp", title: "Synthetic trade", at, endAt, chartScope: "in-chart", carriedIn: false, reversal: false, factualReason: "Trading a support rebound.", orderCount: 2, fillCount: 2, feesUsd: "5", realizedPnlUsd: "100", fundingUsd: "0", peakWalletLeverage: 2, peakAssetLeverage: 2, stages: [stage("open-long", at), stage("close-long", endAt)], notes: ["PRIVATE_NOTE"], contextEvidence: [], ...extra });
const id = "idea-0123456789abcdef", tradeId = (i: number) => `perp-${String(i).padStart(16, "0")}`;
function review(facts: ActivityGroupFacts) { return { ...defaultActivityReview(facts), status: "reviewed" as const, grouping: "confirmed" as const, rationaleConfirmed: true, research: { basis: "direct" as const, preparedAt: endAt, explanation: "PRIVATE_EXPLANATION", sources: [{ title: "PRIVATE_DRAFT_TITLE", url: "https://writer.substack.com/publish/post/123", articleUrl: "https://writer.substack.com/p/private-draft", at, status: "draft" as const, relationship: "direct" as const, timing: "contemporaneous" as const }] } }; }
test("only approved direct ideas qualify, with every unpublished reference withheld", () => {
  const f = group(), r = review(f), projected = projectIdea(f, r, id, "Support rebound");
  assert.ok(projected); assert.equal(projected.articleUrl, ""); assert.equal(projected.articleStatus, "awaiting-publication");
  for (const secret of ["PRIVATE_", "publish/post", "private-draft", "funding", "leverage", "quantity", "feesUsd"]) assert.ok(!JSON.stringify(projected).includes(secret));
  assert.equal(projectIdea(f, { ...r, status: "pending" }, id, "Support rebound"), null);
  assert.equal(projectIdea(f, { ...r, research: { ...r.research, basis: "context" } }, id, "Support rebound"), null);
  assert.equal(projectIdea(group({ market: "context" }), r, id, "Cash transition"), null);
  assert.throws(() => projectIdea(f, { ...r, reason: "Bought 2 BTC" }, id, "Support rebound"));
});
test("verified article links are allowed, while reversals become separate minimal trades", () => {
  const f = group(), r = review(f);
  const published = { ...r, research: { ...r.research, sources: [{ ...r.research.sources[0], status: "published" as const }] } };
  assert.equal(projectIdea(f, published, id, "Support rebound")!.articleUrl, r.research.sources[0].articleUrl);
  const reverseAt = "2025-03-02T00:00:00.000Z";
  const rows = projectPerpTrades(group({ stages: [stage("open-long", at), stage("reverse-long-short", reverseAt), stage("close-short", endAt)] }), tradeId);
  assert.deepEqual(rows, [{ id: tradeId(0), asset: "BTC", direction: "LONG", openedAt: at, closedAt: reverseAt }, { id: tradeId(1), asset: "BTC", direction: "SHORT", openedAt: reverseAt, closedAt: endAt }]);
  assert.equal(projectPerpTrades(group({ stages: [stage("close-long", endAt)], carriedIn: true }), tradeId)[0].openedAt, null);
  assert.deepEqual(projectPerpTrades(group({ asset: "PAXG" }), tradeId), []);
  assert.deepEqual(projectPerpTrades(group({ market: "spot" }), tradeId), []);
});
test("the visitor contract rejects source identifiers, sizes and preview-token links", () => {
  const f = group(), idea = projectIdea(f, review(f), id, "Support rebound")!;
  const release = { version: 1, status: "localhost-preview", preparedAt: endAt, ideas: [idea], perpTrades: projectPerpTrades(f, tradeId), pendingPerformanceYears: [] };
  assert.equal(portfolioStoriesSchema.safeParse(release).success, true);
  assert.equal(portfolioStoriesSchema.safeParse({ ...release, perpTrades: [{ ...release.perpTrades[0], quantity: "999" }] }).success, false);
  assert.equal(portfolioStoriesSchema.safeParse({ ...release, ideas: [{ ...idea, articleUrl: "https://writer.substack.com/p/draft?token=secret" }] }).success, false);
});


test("standalone owner notes accept no article or an optional public Substack link, without execution data", () => {
  const note = { id: "note-0123456789abcdef", asset: "BTC", period: "2026-02", periodEnd: "2026-08", title: "Accumulation thesis", reason: "Accumulating through market weakness." };
  assert.equal(portfolioEditorialNoteSchema.parse(note).articleUrl, "");
  assert.equal(portfolioEditorialNoteSchema.parse({ ...note, detail: "Kept cash available for further market weakness." }).detail, "Kept cash available for further market weakness.");
  assert.equal(portfolioEditorialNoteSchema.safeParse({ ...note, detail: "Bought 2 BTC" }).success, false);
  assert.equal(portfolioEditorialNoteSchema.safeParse({ ...note, detail: "Account value $12345" }).success, false);
  assert.equal(portfolioEditorialNoteSchema.parse({ ...note, articleUrl: "https://writer.substack.com/p/latest-analysis" }).articleUrl, "https://writer.substack.com/p/latest-analysis");
  for (const extra of [{ openedAt: at }, { direction: "LONG" }, { quantity: "2" }, { sourceGroupId: "PRIVATE_GROUP" }, { allocationPct: 20 }]) assert.equal(portfolioEditorialNoteSchema.safeParse({ ...note, ...extra }).success, false);
  assert.equal(portfolioEditorialNoteSchema.safeParse({ ...note, period: "2026-02-02" }).success, false);
  assert.equal(portfolioEditorialNoteSchema.safeParse({ ...note, periodEnd: "2026-01" }).success, false);
  assert.equal(portfolioEditorialNoteSchema.safeParse({ ...note, reason: "Bought 2 BTC" }).success, false);
  assert.equal(portfolioEditorialNoteSchema.safeParse({ ...note, articleUrl: "https://writer.substack.com/p/draft?preview=secret" }).success, false);
});
