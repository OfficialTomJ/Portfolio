import { Binary, type Db, type MongoClient } from "mongodb";
import { BREAKOUT_ACCOUNT_ID, BreakoutInputError, breakoutConflicts, breakoutFingerprint, parseBreakoutCsv,
  type BreakoutAccount, type BreakoutRecord } from "./breakout";

export const BREAKOUT_COLLECTIONS = { accounts: "performance_private_import_accounts", batches: "performance_private_import_batches", rows: "performance_private_import_rows" } as const;
export class BreakoutConflictError extends Error {}
export interface ImportSummary {
  id: string; filename: string; completedAt: string; newRows: number; duplicates: number;
  needsReconciliation: number; readyToReview: number; historyThrough: string;
  reused?: boolean;
}
interface ImportBatch {
  _id: string; accountId: string; fileSha256: string; rawBytes: Binary; uploader: string;
  summary: ImportSummary;
}

export async function importBreakoutCsv(db: Db, client: MongoClient, input: {
  bytes: Uint8Array; filename: string; historyFrom: string; userId: string; accountId: string;
}): Promise<ImportSummary> {
  // Whole-file, fail-closed validation precedes even a session/index/write.
  const file = parseBreakoutCsv(input.bytes);
  if (input.accountId !== BREAKOUT_ACCOUNT_ID) throw new BreakoutInputError("Choose the configured Breakout account.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.historyFrom) || !Number.isFinite(Date.parse(`${input.historyFrom}T00:00:00Z`)) ||
    new Date(`${input.historyFrom}T00:00:00Z`).toISOString().slice(0, 10) !== input.historyFrom ||
    input.historyFrom < "2020-01-01" || input.historyFrom > file.firstEntry.slice(0, 10)) throw new BreakoutInputError("History start must be a valid UTC date on or before the first entry.");
  if (!input.filename.toLowerCase().endsWith(".csv") || input.filename.length > 160 || /[\p{Cc}\p{Cf}<>/\\]/u.test(input.filename)) throw new BreakoutInputError("Use an ordinary .csv filename.");
  // Initialize storage only after validation, so the transaction commits
  // documents in existing namespaces.
  for (const name of Object.values(BREAKOUT_COLLECTIONS)) {
    try { await db.createCollection(name); }
    catch (error) { if ((error as { code?: number }).code !== 48) throw error; }
  }
  const id = `${BREAKOUT_ACCOUNT_ID}:${file.sha256}`;
  const session = client.startSession();
  let summary: ImportSummary | undefined;
  try {
    await session.withTransaction(async () => {
      const accounts = db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts);
      const batches = db.collection<ImportBatch>(BREAKOUT_COLLECTIONS.batches);
      const records = db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows);
      const account = await accounts.findOne({ _id: BREAKOUT_ACCOUNT_ID }, { session });
      const historyFrom = `${input.historyFrom}T00:00:00.000Z`;
      if (account && account.historyFrom !== historyFrom) throw new BreakoutConflictError("The account's history start is locked. Ask for reconciliation to change it.");
      const prior = await batches.findOne({ _id: id }, { session });
      if (prior) { summary = { ...prior.summary, newRows: 0, duplicates: file.rows.length, readyToReview: 0, needsReconciliation: 0, reused: true }; return; }
      const now = new Date();
      // Writing the account in every transaction serializes imports, annotations
      // and publication. Concurrent scans cannot miss one another's new rows.
      await accounts.updateOne({ _id: BREAKOUT_ACCOUNT_ID }, { $inc: { importRevision: 1 }, $set: {
        lastImportedAt: now, historyThrough: account && account.historyThrough > file.lastExit ? account.historyThrough : file.lastExit,
      }, $setOnInsert: { firstImportedAt: now, historyFrom } }, { upsert: true, session });
      const existing = await records.find({ accountId: BREAKOUT_ACCOUNT_ID }, { session }).limit(20_001).toArray();
      if (existing.length > 20_000) throw new BreakoutConflictError("Account history requires a larger import review. No changes were saved.");
      const known = new Map(existing.map(row => [row.key, row]));
      const fresh = file.rows.filter(row => !known.has(row.key));
      const all = [...existing, ...fresh];
      if (all.length > 20_000) throw new BreakoutConflictError("This import exceeds the account history limit. Ask for an import review; no records were saved.");
      const held = breakoutConflicts(all);
      // Correction candidates share a stable source entry. Never overwrite them.
      const byIdentity = new Map<string, string>();
      for (const row of all) {
        const priorKey = byIdentity.get(row.identity);
        if (priorKey && priorKey !== row.key) { held.add(priorKey); held.add(row.key); }
        byIdentity.set(row.identity, row.key);
      }
      const documents: BreakoutRecord[] = fresh.map(row => ({ ...row, _id: row.trade.id, accountId: BREAKOUT_ACCOUNT_ID,
        batchId: id, importedAt: now, riskConfirmed: false, fingerprint: breakoutFingerprint(row),
        status: held.has(row.key) ? "reconciliation" : "pending_review",
        ...(held.has(row.key) ? { reason: "Overlapping positions or possible source correction. Agent reconciliation required; no grouping was inferred." } : {}),
      }));
      if (documents.length) await records.insertMany(documents, { session });
      // Previously clean pending rows may become ambiguous in a later export.
      const newlyHeld = existing.filter(row => held.has(row.key) && row.status === "pending_review");
      if (newlyHeld.length) await records.updateMany({ _id: { $in: newlyHeld.map(row => row._id) }, status: "pending_review" },
        { $set: { status: "reconciliation", reason: "A later upload overlaps this position or may correct it. Agent reconciliation required." } }, { session });
      summary = { id, filename: input.filename, completedAt: now.toISOString(), newRows: documents.length,
        duplicates: file.rows.length - documents.length, needsReconciliation: documents.filter(row => row.status === "reconciliation").length,
        readyToReview: documents.filter(row => row.status === "pending_review").length, historyThrough: file.lastExit };
      await batches.insertOne({ _id: id, accountId: BREAKOUT_ACCOUNT_ID, fileSha256: file.sha256,
        rawBytes: new Binary(input.bytes), uploader: input.userId, summary }, { session });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, timeoutMS: 30_000, maxCommitTimeMS: 10_000 });
  } finally { await session.endSession(); }
  return summary!;
}

export async function readBreakoutAccount(db: Db): Promise<BreakoutAccount | null> {
  return db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).findOne({ _id: BREAKOUT_ACCOUNT_ID });
}
export async function readImportHistory(db: Db): Promise<ImportSummary[]> {
  const docs = await db.collection<ImportBatch>(BREAKOUT_COLLECTIONS.batches).find({ accountId: BREAKOUT_ACCOUNT_ID },
    { projection: { summary: 1 } }).sort({ "summary.completedAt": -1 }).limit(20).toArray();
  return docs.map(doc => doc.summary);
}
