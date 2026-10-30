import { Binary, type Db, type MongoClient, type ClientSession } from "mongodb";
import { BREAKOUT_ACCOUNT_ID, MAX_CSV_ROWS, BreakoutInputError, breakoutFingerprint, digest, parseBreakoutCsv,
  type BreakoutAccount, type BreakoutRecord, type BreakoutRow } from "./breakout";
import { planBreakoutImport, type ImportPreview } from "./breakout-preview";

export const BREAKOUT_COLLECTIONS = { accounts: "performance_private_import_accounts", batches: "performance_private_import_batches", rows: "performance_private_import_rows", evidence: "performance_private_import_evidence" } as const;
export class BreakoutConflictError extends Error {}
export interface ImportSummary {
  id: string; filename: string; completedAt: string; newRows: number; duplicates: number;
  needsReconciliation: number; readyToReview: number; historyThrough: string;
  skippedRows?: number; reused?: boolean;
}
export interface BreakoutUpload { bytes: Uint8Array; filename: string; accountId: string }
export interface BreakoutSelection { fileSha256: string; revision: number; selectedKeys: string[] }
interface ImportBatch {
  _id: string; accountId: string; fileSha256: string; rawBytes: Binary; uploader: string;
  selectedKeys: string[]; summary: ImportSummary;
}
export interface ImportEvidence extends BreakoutRow { _id: string; accountId: string; batchId: string }

function validateFile(input: BreakoutUpload) {
  const file = parseBreakoutCsv(input.bytes);
  if (input.accountId !== BREAKOUT_ACCOUNT_ID) throw new BreakoutInputError("Choose the configured Breakout account.");
  if (!input.filename.toLowerCase().endsWith(".csv") || input.filename.length > 160 || /[\p{Cc}\p{Cf}<>/\\]/u.test(input.filename)) throw new BreakoutInputError("Use an ordinary .csv filename.");
  return file;
}
async function storedHistory(db: Db, session: ClientSession) {
  const account = await db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).findOne({ _id: BREAKOUT_ACCOUNT_ID }, { session });
  const existing = await db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows).find({ accountId: BREAKOUT_ACCOUNT_ID }, { session }).limit(20_001).toArray();
  const evidence = await db.collection<ImportEvidence>(BREAKOUT_COLLECTIONS.evidence).find({ accountId: BREAKOUT_ACCOUNT_ID }, { session }).limit(20_001).toArray();
  if (existing.length > 20_000 || evidence.length > 20_000) throw new BreakoutConflictError("Account history requires a larger import review. No changes were saved.");
  return { account, existing, evidence };
}

/** Read-only snapshot: neither the CSV nor a candidate is saved before confirmation. */
export async function previewBreakoutCsv(db: Db, client: MongoClient, input: BreakoutUpload): Promise<ImportPreview> {
  const file = validateFile(input);
  const session = client.startSession();
  try {
    return (await session.withTransaction(async () => {
      const { account, existing, evidence } = await storedHistory(db, session);
      const plan = planBreakoutImport(file, existing, evidence);
      if (plan.all.length > 20_000) throw new BreakoutConflictError("This file exceeds the account history limit. Ask for an import review.");
      return { fileSha256: file.sha256, revision: account?.importRevision ?? 0, rows: plan.rows,
        clean: plan.rows.filter(row => row.status === "new").length,
        reconciliation: plan.rows.filter(row => row.status === "reconciliation").length,
        duplicates: plan.rows.filter(row => row.status === "duplicate").length, affectedPending: plan.affectedPending };
    }, { readConcern: { level: "snapshot" }, timeoutMS: 30_000 }))!;
  } finally { await session.endSession(); }
}

export async function importBreakoutCsv(db: Db, client: MongoClient, input: BreakoutUpload & BreakoutSelection & { userId: string }): Promise<ImportSummary> {
  // Revalidate the entire original file and selection before any storage write.
  const file = validateFile(input);
  if (input.fileSha256 !== file.sha256 || !Number.isSafeInteger(input.revision) || input.revision < 0 ||
    !Array.isArray(input.selectedKeys) || !input.selectedKeys.length || input.selectedKeys.length > MAX_CSV_ROWS ||
    input.selectedKeys.some(key => typeof key !== "string" || !/^[a-f0-9]{64}$/.test(key)) || new Set(input.selectedKeys).size !== input.selectedKeys.length) throw new BreakoutInputError("Preview the file and select positions before importing.");
  const selected = new Set(input.selectedKeys);
  const fileKeys = new Set(file.rows.map(row => row.key));
  if (input.selectedKeys.some(key => !fileKeys.has(key))) throw new BreakoutInputError("The selection does not belong to this CSV. Preview it again.");
  const id = `${BREAKOUT_ACCOUNT_ID}:${file.sha256}:${digest(JSON.stringify([...selected].sort()))}`;
  for (const name of Object.values(BREAKOUT_COLLECTIONS)) {
    try { await db.createCollection(name); }
    catch (error) { if ((error as { code?: number }).code !== 48) throw error; }
  }
  const session = client.startSession();
  try {
    return (await session.withTransaction(async () => {
      const batches = db.collection<ImportBatch>(BREAKOUT_COLLECTIONS.batches);
      const prior = await batches.findOne({ _id: id }, { session });
      // Safe retry after a lost response, including a now-stale preview revision.
      if (prior) return { ...prior.summary, newRows: 0, duplicates: file.rows.length - (prior.summary.skippedRows ?? 0), readyToReview: 0, needsReconciliation: 0, reused: true };
      const { account, existing, evidence } = await storedHistory(db, session);
      if ((account?.importRevision ?? 0) !== input.revision) throw new BreakoutConflictError("Stored history changed after this preview. Upload and process the file again before confirming.");
      const plan = planBreakoutImport(file, existing, evidence);
      if (plan.all.length > 20_000) throw new BreakoutConflictError("This import exceeds the account history limit. Ask for an import review; no records were saved.");
      const known = new Set(existing.map(row => row.key));
      const fresh = file.rows.filter(row => selected.has(row.key) && !known.has(row.key));
      const now = new Date();
      const duplicates = file.rows.filter(row => known.has(row.key)).length;
      const summary: ImportSummary = { id, filename: input.filename, completedAt: now.toISOString(), newRows: fresh.length,
        duplicates, skippedRows: file.rows.length - fresh.length - duplicates,
        needsReconciliation: fresh.filter(row => plan.held.has(row.key)).length,
        readyToReview: fresh.filter(row => !plan.held.has(row.key)).length,
        historyThrough: fresh.length ? fresh.reduce((last, row) => row.values.exit_time > last ? row.values.exit_time : last, fresh[0].values.exit_time) : account?.historyThrough ?? file.lastExit };
      if (!fresh.length) return summary;
      const first = fresh.reduce((date, row) => row.values.entry_time < date ? row.values.entry_time : date, fresh[0].values.entry_time);
      const firstDay = `${first.slice(0, 10)}T00:00:00.000Z`;
      const historyFrom = account && account.historyFrom < firstDay ? account.historyFrom : firstDay;
      // This write serializes confirmation with imports, risk edits and publication.
      await db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).updateOne({ _id: BREAKOUT_ACCOUNT_ID }, {
        $inc: { importRevision: 1 }, $set: { lastImportedAt: now, historyFrom,
          historyThrough: account && account.historyThrough > summary.historyThrough ? account.historyThrough : summary.historyThrough,
          ...(account?.activatedAt ? { activatedFrom: account.activatedFrom ?? account.historyFrom } : {}) },
        $setOnInsert: { firstImportedAt: now },
      }, { upsert: true, session });
      const records = db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows);
      await records.insertMany(fresh.map(row => ({ ...row, _id: row.trade.id, accountId: BREAKOUT_ACCOUNT_ID,
        batchId: id, importedAt: now, riskConfirmed: false, fingerprint: breakoutFingerprint(row),
        status: plan.held.has(row.key) ? "reconciliation" : "pending_review",
        ...(plan.held.has(row.key) ? { reason: "Overlapping positions or possible source correction. Agent reconciliation required; no grouping was inferred." } : {}),
      })), { session });
      // Deselection cannot hide conflicting evidence or make an existing trade safe.
      const newlyHeld = existing.filter(row => plan.held.has(row.key) && row.status === "pending_review");
      if (newlyHeld.length) await records.updateMany({ _id: { $in: newlyHeld.map(row => row._id) }, status: "pending_review" },
        { $set: { status: "reconciliation", reason: "A later uploaded CSV overlaps this position or may correct it. Agent reconciliation required." } }, { session });
      const evidenceKeys = new Set(evidence.map(row => row.key));
      const unseen = file.rows.filter(row => !evidenceKeys.has(row.key));
      if (unseen.length) await db.collection<ImportEvidence>(BREAKOUT_COLLECTIONS.evidence).insertMany(unseen.map(row => ({ ...row, _id: row.key, accountId: BREAKOUT_ACCOUNT_ID, batchId: id })), { session });
      await batches.insertOne({ _id: id, accountId: BREAKOUT_ACCOUNT_ID, fileSha256: file.sha256,
        rawBytes: new Binary(input.bytes), uploader: input.userId, selectedKeys: [...selected].sort(), summary }, { session });
      return summary;
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, timeoutMS: 30_000, maxCommitTimeMS: 10_000 }))!;
  } finally { await session.endSession(); }
}

export async function readBreakoutAccount(db: Db): Promise<BreakoutAccount | null> {
  return db.collection<BreakoutAccount>(BREAKOUT_COLLECTIONS.accounts).findOne({ _id: BREAKOUT_ACCOUNT_ID });
}
export async function readImportHistory(db: Db): Promise<ImportSummary[]> {
  const docs = await db.collection<ImportBatch>(BREAKOUT_COLLECTIONS.batches).find({ accountId: BREAKOUT_ACCOUNT_ID },
    { projection: { summary: 1 } }).sort({ "summary.completedAt": -1 }).limit(20).toArray();
  return docs.map(doc => doc.summary);
}
