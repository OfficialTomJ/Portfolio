import { MongoClient } from "mongodb";
import { calculatePortfolioDraft, type PortfolioWorkspace } from "./workspace-model";
import { createValuationBasis } from "./live-valuation";
import { visitorPortfolio } from "./visitor-projection";

/** Run with an administrator connection in the environment; never print private ledger inputs. */
async function main() {
  const name = process.argv.find(arg => arg.startsWith("--database="))?.split("=")[1];
  if (name !== "blueprint_dev" && name !== "blueprint_prod") throw new Error("Choose --database=blueprint_dev or --database=blueprint_prod.");
  const production = name === "blueprint_prod", key = production ? "public-portfolio-v1" : "staging-portfolio-v1";
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("An administrator MONGODB_URI is required.");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    const db = client.db(name);
    const pointer = await db.collection<{ _id: string; releaseId: string }>(production ? "portfolio_public_pointers" : "portfolio_review_public_pointers").findOne({ _id: key });
    if (!pointer) throw new Error("No accepted portfolio release.");
    const release = await db.collection<{ _id: string; workspaceId: string; data: unknown }>(production ? "portfolio_public_releases" : "portfolio_review_public_releases").findOne({ _id: pointer.releaseId, workspaceId: key });
    const workspace = await db.collection<PortfolioWorkspace>(production ? "portfolio_workspaces" : "portfolio_review_workspaces").findOne({ _id: key });
    if (!release || !workspace || workspace.publicReleaseId !== pointer.releaseId) throw new Error("The source workspace must match the accepted release.");
    const data = visitorPortfolio(release.data), calculated = visitorPortfolio(calculatePortfolioDraft(workspace.draft).preview);
    for (const field of ["asOf", "points", "allocation", "cashPct", "investedPct", "netPct"] as const) {
      if (JSON.stringify(data[field]) !== JSON.stringify(calculated[field])) throw new Error("Unpublished changes cannot become a live valuation baseline.");
    }
    const basis = createValuationBasis(data, workspace.draft.ledger);
    const store = db.collection<{ _id: string; basis: typeof basis; createdAt: string }>("portfolio_public_valuation_bases");
    const existing = await store.findOne({ _id: pointer.releaseId });
    if (existing && JSON.stringify(existing.basis) !== JSON.stringify(basis)) throw new Error("An existing valuation basis cannot be silently restated.");
    const apply = process.argv.includes("--apply");
    if (apply && !existing) await store.insertOne({ _id: pointer.releaseId, basis, createdAt: new Date().toISOString() });
    console.log(JSON.stringify({ database: name, release: data.release, asOf: basis.asOf, assets: Object.keys(basis.prices), applied: apply, existing: !!existing }));
  } finally { await client.close(); }
}
main().catch(() => { console.error("Live valuation preparation failed. Check the selected database and accepted workspace; no private input was printed."); process.exitCode = 1; });
