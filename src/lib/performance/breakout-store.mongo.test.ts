import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { BREAKOUT_HEADERS, BREAKOUT_ACCOUNT_ID, activeBreakoutHistoryFrom, parseBreakoutCsv, type BreakoutRecord } from "./breakout";
import { BREAKOUT_COLLECTIONS, importBreakoutCsv, readBreakoutAccount } from "./breakout-store";
import { activateBreakoutSource, publishStoredTrade } from "./journal";
import { normalizeClosedCycle } from "./normalize";
import { performanceReviewFingerprint } from "./review";
import { publicTradeIdForCycle } from "./publication";
import type { BybitClosedPnl } from "./bybit";

const row = (date: string, overrides: Partial<Record<typeof BREAKOUT_HEADERS[number], string>> = {}) => {
  const values = { instrument: "BTC/USD", side: "long", quantity: "1", entry_price: "100", exit_price: "110",
    entry_time: `${date}T00:00:00.123456789Z`, exit_time: `${date}T01:00:00.123456789Z`, realized_pnl: "10", fees: "1", net_pnl: "9", ...overrides };
  return BREAKOUT_HEADERS.map(key => values[key]).join(",");
};
const csv = (...rows: string[]) => new TextEncoder().encode([BREAKOUT_HEADERS.join(","), ...rows].join("\n"));

test("transactional CSV import, rejection, idempotency, source switch and reviewed publication", { skip: process.env.BREAKOUT_MONGO_TEST !== "1", timeout: 120_000 }, async () => {
  assert.ok(process.env.MONGODB_URI, "Provide a test MongoDB connection with transaction support");
  const name = `blueprint_breakout_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  const db = client.db(name);
  console.log(`Disposable import test database: ${name}`);
  const input = (bytes: Uint8Array, filename = "positions.csv") => ({ bytes, filename, accountId: BREAKOUT_ACCOUNT_ID, userId: "test-admin" });
  const dump = async () => {
    const names = await db.listCollections({}, { nameOnly: true }).toArray();
    return JSON.stringify(await Promise.all(names.sort((a, b) => a.name.localeCompare(b.name)).map(async c => [c.name, await db.collection(c.name).find({}).sort({ _id: 1 }).toArray()])));
  };
  try {
    // A bad final row must not create even the import/account collections.
    await assert.rejects(importBreakoutCsv(db, client, input(csv(row("2025-01-01"), row("2025-01-02", { net_pnl: "8" })))), /net P&L/);
    assert.equal((await db.listCollections().toArray()).length, 0);
    console.log("Invalid file made no writes; testing first valid import.");
    const initial = csv(row("2025-01-01"), row("2025-01-03"));
    const result = await importBreakoutCsv(db, client, input(initial));
    console.log("First valid import committed.");
    assert.equal(result.newRows, 2); assert.equal(result.readyToReview, 2);
    const archived = await db.collection(BREAKOUT_COLLECTIONS.batches).findOne({ _id: result.id } as never);
    assert.deepEqual(new Uint8Array(archived!.rawBytes.buffer), initial);
    assert.equal(await db.collection("performance_published_trades").countDocuments(), 0);
    const unchanged = await dump();
    await assert.rejects(importBreakoutCsv(db, client, input(csv(row("2025-01-04", { side: "BUY" })))), /side/);
    assert.equal(await dump(), unchanged, "rejected file changed database evidence");
    const retry = await importBreakoutCsv(db, client, input(initial, "renamed.csv"));
    assert.equal(retry.reused, true); assert.equal(retry.newRows, 0); assert.equal(await dump(), unchanged);
    const reordered = await importBreakoutCsv(db, client, input(csv(row("2025-01-03"), row("2025-01-01"))));
    assert.equal(reordered.newRows, 0); assert.equal(reordered.duplicates, 2);
    assert.equal(await db.collection(BREAKOUT_COLLECTIONS.rows).countDocuments(), 2);
    const recentOnly = await importBreakoutCsv(db, client, input(csv(row("2025-01-03"))));
    assert.equal(recentOnly.newRows, 0); assert.equal(recentOnly.duplicates, 1);
    assert.equal((await readBreakoutAccount(db))?.historyFrom, "2025-01-01T00:00:00.000Z");
    assert.equal(await db.collection(BREAKOUT_COLLECTIONS.rows).countDocuments(), 2);
    const clean = (await db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows).findOne({ "values.entry_time": "2025-01-03T00:00:00.123456789Z" }))!;
    await assert.rejects(publishStoredTrade(db, client, clean._id, clean.fingerprint), /source switch/);
    const account = (await readBreakoutAccount(db))!;
    await assert.rejects(activateBreakoutSource(db, client, account.importRevision + 1), /changed/);
    await activateBreakoutSource(db, client, account.importRevision);
    await assert.rejects(publishStoredTrade(db, client, clean._id, clean.fingerprint), /risk confirmation/);
    await db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows).updateOne({ _id: clean._id }, { $set: { riskConfirmed: true } });
    await assert.rejects(publishStoredTrade(db, client, clean._id, "0".repeat(64)), /changed/);
    await publishStoredTrade(db, client, clean._id, clean.fingerprint);
    assert.equal(await db.collection("performance_published_trades").countDocuments(), 1);
    const publicTrade = await db.collection("performance_published_trades").findOne({ id: clean._id });
    assert.equal(publicTrade?.source, "breakout"); assert.equal(publicTrade?.resultR, 0.009);
    assert.equal(publicTrade?.fees, undefined); assert.equal(publicTrade?.accountId, undefined);
    // A correction is preserved separately, holding the old pending candidate.
    const correction = await importBreakoutCsv(db, client, input(csv(row("2025-01-01", { fees: "2", net_pnl: "8" }))));
    assert.equal(correction.needsReconciliation, 1);
    const held = await db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows).find({ "values.entry_time": "2025-01-01T00:00:00.123456789Z" }).toArray();
    assert.equal(held.length, 2); assert.ok(held.every(r => r.status === "reconciliation"));
    await assert.rejects(publishStoredTrade(db, client, held[0]._id, held[0].fingerprint), /reconciliation/);
    // Even a late overlap with a published row cannot alter its result.
    const beforePublic = JSON.stringify(publicTrade);
    const late = await importBreakoutCsv(db, client, input(csv(row("2025-01-03", { entry_time: "2025-01-03T00:30:00Z" }))));
    assert.equal(late.needsReconciliation, 1);
    assert.equal(JSON.stringify(await db.collection("performance_published_trades").findOne({ id: clean._id })), beforePublic);
    // Concurrent uploads serialize or return a retryable conflict, never duplicates.
    const bytes = csv(row("2025-01-06"));
    const runs = await Promise.allSettled([importBreakoutCsv(db, client, input(bytes)), importBreakoutCsv(db, client, input(bytes))]);
    assert.ok(runs.some(result => result.status === "fulfilled"));
    await importBreakoutCsv(db, client, input(bytes));
    assert.equal(await db.collection(BREAKOUT_COLLECTIONS.rows).countDocuments({ "values.entry_time": "2025-01-06T00:00:00.123456789Z" }), 1);
    // A partial later export keeps old source rows and published history intact.
    assert.equal(await db.collection(BREAKOUT_COLLECTIONS.rows).countDocuments(), 5);
    assert.equal(await db.collection("performance_published_trades").countDocuments(), 1);
    // A storage conflict after the account revision write rolls back the batch.
    const blocked = parseBreakoutCsv(csv(row("2025-01-07"))).rows[0];
    const obstacle = { ...clean, _id: blocked.trade.id, key: "collision-fixture", identity: "collision-fixture" };
    await db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows).insertOne(obstacle);
    const beforeStorageFailure = await dump();
    await assert.rejects(importBreakoutCsv(db, client, input(csv(row("2025-01-07")))));
    assert.equal(await dump(), beforeStorageFailure, "failed transaction leaked account or batch changes");
    // Earlier reviewed Bybit history can still publish using stored evidence,
    // with every HTTP fetch disabled. Covered legacy results cannot publish.
    const environment = process.env.BYBIT_ENV ?? "demo";
    await db.collection<{ _id: string; lastRunId: string }>("performance_private_sync_state").insertOne({ _id: environment, lastRunId: "legacy-run" });
    await db.collection<{ _id: string; status: string; sourceAccountId: string; environment: string }>("performance_private_sync_runs").insertOne({ _id: "legacy-run", status: "succeeded", sourceAccountId: "legacy-account", environment });
    async function legacyCandidate(cycleId: string, date: string) {
      const id = publicTradeIdForCycle(cycleId);
      const closeTime = String(new Date(`${date}T01:00:00Z`).getTime());
      const record: BybitClosedPnl = { orderId: cycleId, symbol: "BTCUSDT", side: "Sell", qty: "1", closedSize: "1", avgEntryPrice: "100", avgExitPrice: "110", closedPnl: "9", execType: "Trade", createdTime: closeTime, updatedTime: closeTime };
      const openedAt = new Date(`${date}T00:00:00Z`);
      const normalized = normalizeClosedCycle({ id, symbol: "BTCUSDT", direction: "Long", openedAt, fallbackEntryPrice: 100, riskAmount: 1000 }, [record]);
      assert.ok(normalized.ok);
      const fingerprint = performanceReviewFingerprint(normalized.trade, [record], "legacy:v1", 1000);
      await db.collection<{ _id: string }>("performance_private_position_cycles").insertOne({ _id: cycleId, environment, sourceAccountId: "legacy-account", status: "pending_review", symbol: "BTCUSDT", direction: "Long", openedAt, entryPrice: 100, riskAmount: 1000, riskVersionId: "legacy:v1", reviewCandidate: normalized.trade, reviewFingerprint: fingerprint } as never);
      await db.collection<{ _id: string }>("performance_private_closed_pnl").insertOne({ _id: cycleId, ...record, cycleId, environment, sourceAccountId: "legacy-account" } as never);
      return { id, fingerprint };
    }
    const old = await legacyCandidate("legacy-before-breakout", "2024-12-20");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("Exchange refresh is forbidden"); };
    try { await publishStoredTrade(db, client, old.id, old.fingerprint); }
    finally { globalThis.fetch = originalFetch; }
    assert.equal(await db.collection("performance_published_trades").countDocuments(), 2);
    const covered = await legacyCandidate("legacy-covered-by-breakout", "2025-01-10");
    const beforeLegacyRejection = await dump();
    await assert.rejects(publishStoredTrade(db, client, covered.id, covered.fingerprint), /covered/);
    assert.equal(await dump(), beforeLegacyRejection);
    assert.equal(parseBreakoutCsv(initial).rows.length, 2);
    // Rolling exports can contain a mixture of already stored and new positions.
    const rolling = await importBreakoutCsv(db, client, input(csv(row("2025-01-06"), row("2025-01-08"))));
    assert.equal(rolling.newRows, 1); assert.equal(rolling.duplicates, 1);
    assert.equal((await readBreakoutAccount(db))?.historyFrom, "2025-01-01T00:00:00.000Z");
    // Older backfills extend private history without silently changing public results.
    const beforeBackfillPublic = JSON.stringify(await db.collection("performance_published_trades").find({}).sort({ _id: 1 }).toArray());
    await importBreakoutCsv(db, client, input(csv(row("2024-12-25"))));
    const backfilled = (await readBreakoutAccount(db))!;
    assert.equal(backfilled.historyFrom, "2024-12-25T00:00:00.000Z");
    assert.equal(backfilled.historyThrough, "2025-01-08T01:00:00.123456789Z");
    assert.equal(activeBreakoutHistoryFrom(backfilled), "2025-01-01T00:00:00.000Z");
    assert.equal(JSON.stringify(await db.collection("performance_published_trades").find({}).sort({ _id: 1 }).toArray()), beforeBackfillPublic);
    const earlier = (await db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows).findOne({ "values.entry_time": "2024-12-25T00:00:00.123456789Z" }))!;
    await db.collection<BreakoutRecord>(BREAKOUT_COLLECTIONS.rows).updateOne({ _id: earlier._id }, { $set: { riskConfirmed: true } });
    await assert.rejects(publishStoredTrade(db, client, earlier._id, earlier.fingerprint), /source switch for the earlier/);
    await activateBreakoutSource(db, client, backfilled.importRevision);
    assert.equal(activeBreakoutHistoryFrom(await readBreakoutAccount(db)), backfilled.historyFrom);
    await publishStoredTrade(db, client, earlier._id, earlier.fingerprint);
    assert.equal(await db.collection("performance_published_trades").countDocuments(), 3);
  } finally {
    assert.match(db.databaseName, /^blueprint_breakout_test_[a-f0-9]+$/);
    try { await db.dropDatabase(); } finally { await client.close(); }
  }
});
