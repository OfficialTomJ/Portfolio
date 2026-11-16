import "server-only";
import { getMongoClient } from "@/lib/mongodb";
import { btcMockEnabled, portfolioDatabaseEnabled } from "./mode";
import { loadDatabasePortfolio } from "./workspace-repository";
import { adminSnapshot, applyCommand, initialWorkspace, PortfolioConflictError } from "./model";
import { publicSchema, type Command, type Workspace } from "./schema";
import { loadActiveReconstructionPublic } from "./backfill-repository";
import { withLocalChartHistory } from "./history-repository";
import { withLocalPortfolioStories } from "./stories-repository";
import { withLocalPropPerformance } from "./prop-performance-repository";
import { withholdWalletHistory } from "./privacy";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { withLocalEditorialNotes } from "./editorial-repository";

const KEY = "btc-mock-v1";
const collection = () => {
  if (!btcMockEnabled()) throw new Error("Mock portfolio is disabled.");
  // Deliberately independent of MONGODB_DB, prod restore collections and every prior journal workspace.
  return getMongoClient().db("blueprint_dev").collection<Workspace>("btc_portfolio_mock_workspaces");
};
export async function loadBtcAdmin() {
  return adminSnapshot(await collection().findOne({ _id: KEY }) ?? initialWorkspace());
}
export async function loadBtcPublic() {
  if (portfolioDatabaseEnabled()) return loadDatabasePortfolio();
  const reconstruction = await loadActiveReconstructionPublic();
  if (reconstruction) {
    // No real reconstruction can be exposed by deploying the localhost preview.
    if (process.env.NODE_ENV !== "development") throw new Error("Portfolio reconstruction is available only in local review.");
    // The owner approved the curve; execution records and linked trade ideas remain private.
    return withLocalEditorialNotes(withholdWalletHistory(await withLocalChartHistory(await withLocalPropPerformance(reconstruction)), { walletCurveApproved: true }));
  }
  const record = await collection().findOne({ _id: KEY }, { projection: { published: 1 } });
  return withLocalPortfolioStories(publicSchema.parse(record ? record.published : initialWorkspace().published));
}
/** Full wallet-derived history is available only to the local owner review workflow. */
export async function loadBtcReviewPreview() {
  if (process.env.NODE_ENV !== "development" || !await getPerformanceAdminSession()) throw new Error("Private portfolio review is unavailable.");
  const reconstruction = await loadActiveReconstructionPublic();
  if (reconstruction) return withLocalEditorialNotes(await withLocalPortfolioStories(await withLocalChartHistory(await withLocalPropPerformance(reconstruction))));
  return loadBtcPublic();
}
export async function mutateBtc(command: Command, actor: string) {
  const store = collection();
  let current = await store.findOne({ _id: KEY });
  if (!current) {
    try { await store.insertOne(initialWorkspace()); } catch (e) { if ((e as { code?: number }).code !== 11000) throw e; }
    current = await store.findOne({ _id: KEY });
  }
  if (!current) throw new Error("Could not initialize mock storage.");
  if (current.operations.includes(command.requestId)) return adminSnapshot(current);
  const next = applyCommand(current, command, actor);
  const result = await store.replaceOne({ _id: KEY, revision: current.revision }, next);
  if (!result.matchedCount) {
    const latest = await store.findOne({ _id: KEY });
    if (latest?.operations.includes(command.requestId)) return adminSnapshot(latest);
    throw new PortfolioConflictError("Another edit saved first. Refresh status; your form is retained.");
  }
  return adminSnapshot(next);
}
