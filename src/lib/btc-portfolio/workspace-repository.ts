import "server-only";
import { randomUUID } from "node:crypto";
import { getMongoClient } from "@/lib/mongodb";
import { portfolioDatabaseEnabled } from "./mode";
import { publicSchema } from "./schema";
import { calculatePortfolioDraft, prepareWorkspaceChange, WorkspaceConflict, type PortfolioWorkspace, type PortfolioWorkspaceSnapshot, type WorkspaceCommand } from "./workspace-model";

const KEY = "staging-portfolio-v1";
const database = () => { if (!portfolioDatabaseEnabled() || (process.env.MONGODB_DB ?? "blueprint_dev") !== "blueprint_dev") throw new Error("Portfolio review is unavailable."); return getMongoClient().db("blueprint_dev", { ignoreUndefined: true }); };
const workspace = () => database().collection<PortfolioWorkspace>("portfolio_review_workspaces");
interface Release { _id: string; workspaceId: string; sequence: number; at: string; data: unknown }
/** Visitor requests read only the minimal release and pointer collections. */
export async function loadDatabasePortfolio() {
  const db = database(), pointer = await db.collection<{ _id: string; releaseId: string }>("portfolio_review_public_pointers").findOne({ _id: KEY });
  if (!pointer) throw new Error("No reviewed portfolio release is available.");
  const release = await db.collection<Release>("portfolio_review_public_releases").findOne({ _id: pointer.releaseId, workspaceId: KEY }, { projection: { data: 1 } });
  if (!release) throw new Error("Portfolio release is unavailable.");
  return publicSchema.parse(release.data);
}
export async function loadPortfolioWorkspace(): Promise<PortfolioWorkspaceSnapshot> {
  const db = database(), record = await workspace().findOne({ _id: KEY });
  if (!record) throw new Error("The portfolio workspace has not been prepared.");
  const calculated = calculatePortfolioDraft(record.draft);
  const [published, releases, audit] = await Promise.all([
    loadDatabasePortfolio(),
    db.collection<Release>("portfolio_review_public_releases").find({ workspaceId: KEY }, { projection: { sequence: 1, at: 1 } }).sort({ sequence: -1 }).limit(100).toArray(),
    db.collection<{ _id: string; workspaceId: string; at: string; action: string; reason: string; revision: number }>("portfolio_review_private_audit").find({ workspaceId: KEY }, { projection: { at: 1, action: 1, reason: 1, revision: 1 } }).sort({ revision: -1 }).limit(40).toArray(),
  ]);
  return { revision: record.revision, draft: record.draft, fingerprint: calculated.fingerprint, validated: record.validatedFingerprint === calculated.fingerprint, preview: calculated.preview, published, summary: calculated.summary, checks: calculated.checks, releases: releases.map(row => ({ id: row._id, sequence: row.sequence, at: row.at })), audit: audit.map(({ at, action, reason, revision }) => ({ at, action, reason, revision })) };
}
export async function mutatePortfolioWorkspace(command: WorkspaceCommand, actor: string) {
  const db = database(), client = getMongoClient(), session = client.startSession();
  try { await session.withTransaction(async () => {
    const store = workspace(), current = await store.findOne({ _id: KEY }, { session });
    if (!current) throw new Error("Portfolio workspace is unavailable.");
    const prepared = prepareWorkspaceChange(current, command);
    if (!prepared) return;
    const { next, calculated } = prepared;
    if (command.action === "publish") {
      const previous = await db.collection<Release>("portfolio_review_public_releases").findOne({ workspaceId: KEY }, { session, sort: { sequence: -1 } });
      const id = randomUUID(), sequence = (previous?.sequence ?? 0) + 1;
      const data = publicSchema.parse({ ...calculated.preview, publishedAt: next.updatedAt, release: sequence });
      await db.collection<Release>("portfolio_review_public_releases").insertOne({ _id: id, workspaceId: KEY, sequence, at: next.updatedAt, data }, { session });
      await db.collection<{ _id: string; releaseId: string }>("portfolio_review_public_pointers").updateOne({ _id: KEY }, { $set: { releaseId: id } }, { session });
      next.publicReleaseId = id;
    }
    if (command.action === "restore") {
      const release = await db.collection<Release>("portfolio_review_public_releases").findOne({ _id: command.releaseId, workspaceId: KEY }, { session });
      if (!release) throw new Error("Release not found.");
      publicSchema.parse(release.data);
      await db.collection<{ _id: string; releaseId: string }>("portfolio_review_public_pointers").updateOne({ _id: KEY }, { $set: { releaseId: release._id } }, { session });
      next.publicReleaseId = release._id;
    }
    const changed = await store.replaceOne({ _id: KEY, revision: current.revision }, next, { session });
    if (!changed.matchedCount) throw new WorkspaceConflict("Another edit won. Refresh status before retrying.");
    await db.collection<{ _id: string; workspaceId: string; at: string; actor: string; action: string; reason: string; revision: number; before: PortfolioWorkspace }>("portfolio_review_private_audit").insertOne({ _id: randomUUID(), workspaceId: KEY, at: next.updatedAt, actor, action: command.action, reason: "reason" in command ? command.reason : command.action, revision: next.revision, before: current }, { session });
  }); } finally { await session.endSession(); }
  return loadPortfolioWorkspace();
}
