import assert from "node:assert/strict";
import test from "node:test";
import type { Collection } from "mongodb";
import type { BybitSnapshot } from "./bybit";
import {
  buildPerformanceSnapshotArchive,
  PERFORMANCE_SNAPSHOT_BLOB_SCHEMA_VERSION,
  PERFORMANCE_SNAPSHOT_MANIFEST_SCHEMA_VERSION,
  persistPerformanceSnapshotArchive,
  reconstructPerformanceSnapshot,
  type PerformanceSnapshotBlobDocument,
  type PerformanceSnapshotManifestDocument,
} from "./snapshot-archive";

class MemoryCollection<T extends { _id: string }> {
  readonly documents = new Map<string, T>();

  async updateOne(
    filter: { _id: string },
    update: { $setOnInsert: T }
  ): Promise<{ upsertedCount: number }> {
    if (this.documents.has(filter._id)) return { upsertedCount: 0 };
    this.documents.set(filter._id, structuredClone(update.$setOnInsert));
    return { upsertedCount: 1 };
  }

  find(filter: { _id: { $in: string[] } }) {
    return {
      toArray: async () => filter._id.$in
        .map((id) => this.documents.get(id))
        .filter((document): document is T => document !== undefined),
    };
  }

  async insertOne(document: T): Promise<void> {
    if (this.documents.has(document._id)) throw new Error("duplicate key");
    this.documents.set(document._id, structuredClone(document));
  }
}

function asCollection<T extends { _id: string }>(value: MemoryCollection<T>): Collection<T> {
  return value as unknown as Collection<T>;
}

function snapshot(): BybitSnapshot {
  return {
    environment: "demo",
    serverTime: Date.parse("2026-09-20T00:00:00.000Z"),
    apiKey: { userID: 123, readOnly: 1 },
    positions: [],
    executions: [
      {
        execId: "execution-1",
        orderId: "order-1",
        orderLinkId: "",
        symbol: "ETHUSDT",
        side: "Sell",
        execPrice: "2510",
        execQty: "1",
        execValue: "2510",
        execFee: "1",
        execTime: String(Date.parse("2026-09-12T03:26:00.000Z")),
        execType: "Trade",
        orderType: "Market",
        stopOrderType: "",
        closedSize: "0",
        seq: 1,
      },
    ],
    orders: [],
    closedPnl: [],
  };
}

test("creates five section blobs and a lightweight reconstruction manifest", () => {
  const original = snapshot();
  const archive = buildPerformanceSnapshotArchive(
    "run-1",
    original,
    new Date("2026-09-20T00:00:01.000Z"),
    { status: "accepted" }
  );

  assert.equal(archive.manifest._id, "run-1");
  assert.equal(
    archive.manifest.schemaVersion,
    PERFORMANCE_SNAPSHOT_MANIFEST_SCHEMA_VERSION
  );
  assert.equal(archive.manifest.capturedAt.toISOString(), "2026-09-20T00:00:00.000Z");
  assert.equal(archive.blobs.length, 5);
  assert.ok(archive.blobs.every(
    (blob) => blob.schemaVersion === PERFORMANCE_SNAPSHOT_BLOB_SCHEMA_VERSION
  ));
  assert.deepEqual(reconstructPerformanceSnapshot(archive.manifest, archive.blobs), original);
});

test("deduplicates unchanged sections across runs", () => {
  const first = buildPerformanceSnapshotArchive(
    "run-1",
    snapshot(),
    new Date("2026-09-20T00:00:01.000Z"),
    { status: "accepted" }
  );
  const nextSnapshot = snapshot();
  nextSnapshot.serverTime += 15 * 60 * 1000;
  const second = buildPerformanceSnapshotArchive(
    "run-2",
    nextSnapshot,
    new Date("2026-09-20T00:15:01.000Z"),
    { status: "accepted" }
  );

  assert.deepEqual(
    first.blobs.map((blob) => blob._id),
    second.blobs.map((blob) => blob._id)
  );
  assert.notEqual(first.manifest.serverTime, second.manifest.serverTime);
});

test("persists one manifest per run while reusing unchanged blobs", async () => {
  const blobs = new MemoryCollection<PerformanceSnapshotBlobDocument>();
  const manifests = new MemoryCollection<PerformanceSnapshotManifestDocument>();
  const first = buildPerformanceSnapshotArchive(
    "run-1",
    snapshot(),
    new Date(0),
    { status: "accepted" }
  );
  const second = buildPerformanceSnapshotArchive(
    "run-2",
    { ...snapshot(), serverTime: snapshot().serverTime + 1000 },
    new Date(1),
    { status: "accepted" }
  );

  const firstResult = await persistPerformanceSnapshotArchive(
    asCollection(blobs),
    asCollection(manifests),
    first
  );
  const secondResult = await persistPerformanceSnapshotArchive(
    asCollection(blobs),
    asCollection(manifests),
    second
  );

  assert.deepEqual(firstResult, { blobsCreated: 5, blobsReused: 0 });
  assert.deepEqual(secondResult, { blobsCreated: 0, blobsReused: 5 });
  assert.equal(blobs.documents.size, 5);
  assert.equal(manifests.documents.size, 2);
});

test("does not commit a manifest that references an existing corrupted blob", async () => {
  const blobs = new MemoryCollection<PerformanceSnapshotBlobDocument>();
  const manifests = new MemoryCollection<PerformanceSnapshotManifestDocument>();
  const first = buildPerformanceSnapshotArchive(
    "run-1",
    snapshot(),
    new Date(0),
    { status: "accepted" }
  );
  await persistPerformanceSnapshotArchive(
    asCollection(blobs),
    asCollection(manifests),
    first
  );

  const executionId = first.manifest.sections.executions.blobId;
  const stored = blobs.documents.get(executionId);
  assert.ok(stored);
  (stored.payload as BybitSnapshot["executions"])[0].execFee = "corrupted";

  const second = buildPerformanceSnapshotArchive(
    "run-2",
    snapshot(),
    new Date(1),
    { status: "accepted" }
  );
  await assert.rejects(
    persistPerformanceSnapshotArchive(
      asCollection(blobs),
      asCollection(manifests),
      second
    ),
    /failed integrity verification/
  );
  assert.equal(manifests.documents.size, 1);
  assert.equal(manifests.documents.has("run-2"), false);
});

test("changes only the blob for a section whose payload changed", () => {
  const first = buildPerformanceSnapshotArchive(
    "run-1",
    snapshot(),
    new Date(0),
    { status: "accepted" }
  );
  const changed = snapshot();
  changed.executions[0].execFee = "2";
  const second = buildPerformanceSnapshotArchive(
    "run-2",
    changed,
    new Date(1),
    { status: "accepted" }
  );

  for (const section of ["apiKey", "positions", "orders", "closedPnl"] as const) {
    assert.equal(
      first.manifest.sections[section].blobId,
      second.manifest.sections[section].blobId
    );
  }
  assert.notEqual(
    first.manifest.sections.executions.blobId,
    second.manifest.sections.executions.blobId
  );
});

test("records rejected snapshots without dropping their payload", () => {
  const value = snapshot();
  value.apiKey.readOnly = 0;
  const archive = buildPerformanceSnapshotArchive(
    "run-rejected",
    value,
    new Date(0),
    { status: "rejected", error: "Bybit snapshot account identity is invalid" }
  );

  assert.equal(archive.manifest.validation.status, "rejected");
  assert.deepEqual(reconstructPerformanceSnapshot(archive.manifest, archive.blobs), value);
});

test("rejects a corrupted blob during reconstruction", () => {
  const archive = buildPerformanceSnapshotArchive(
    "run-1",
    snapshot(),
    new Date(0),
    { status: "accepted" }
  );
  const corrupted = structuredClone(archive.blobs) as PerformanceSnapshotBlobDocument[];
  const executionBlob = corrupted.find((blob) => blob.section === "executions");
  assert.ok(executionBlob);
  (executionBlob.payload as BybitSnapshot["executions"])[0].execFee = "999";

  assert.throws(
    () => reconstructPerformanceSnapshot(archive.manifest, corrupted),
    /failed integrity verification/
  );
});

test("rejects a manifest with a missing referenced blob", () => {
  const archive = buildPerformanceSnapshotArchive(
    "run-1",
    snapshot(),
    new Date(0),
    { status: "accepted" }
  );

  assert.throws(
    () => reconstructPerformanceSnapshot(archive.manifest, archive.blobs.slice(1)),
    /blob is missing/
  );
});

test("uses canonical object ordering for stable section hashes", () => {
  const firstSnapshot = snapshot();
  const reorderedApiKey = {
    readOnly: firstSnapshot.apiKey.readOnly,
    userID: firstSnapshot.apiKey.userID,
  } as BybitSnapshot["apiKey"];
  const secondSnapshot = { ...snapshot(), apiKey: reorderedApiKey };

  const first = buildPerformanceSnapshotArchive(
    "run-1",
    firstSnapshot,
    new Date(0),
    { status: "accepted" }
  );
  const second = buildPerformanceSnapshotArchive(
    "run-2",
    secondSnapshot,
    new Date(1),
    { status: "accepted" }
  );

  assert.equal(
    first.manifest.sections.apiKey.payloadSha256,
    second.manifest.sections.apiKey.payloadSha256
  );
});

test("falls back to receipt time when upstream server time is invalid", () => {
  const value = snapshot();
  value.serverTime = 0;
  const receivedAt = new Date("2026-09-20T00:00:01.000Z");
  const archive = buildPerformanceSnapshotArchive(
    "run-1",
    value,
    receivedAt,
    { status: "rejected", error: "Bybit snapshot server time is invalid" }
  );

  assert.equal(archive.manifest.capturedAt.toISOString(), receivedAt.toISOString());
});
