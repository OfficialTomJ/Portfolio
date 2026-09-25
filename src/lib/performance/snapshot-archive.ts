import { createHash } from "crypto";
import type { Collection } from "mongodb";
import type { BybitSnapshot } from "./bybit";

export const PERFORMANCE_SNAPSHOT_MANIFEST_SCHEMA_VERSION = 3;
export const PERFORMANCE_SNAPSHOT_BLOB_SCHEMA_VERSION = 1;

export const PERFORMANCE_SNAPSHOT_SECTIONS = [
  "apiKey",
  "positions",
  "executions",
  "orders",
  "closedPnl",
  "openOrders",
] as const;

export type PerformanceSnapshotSection = typeof PERFORMANCE_SNAPSHOT_SECTIONS[number];
type LegacySnapshotSection = Exclude<PerformanceSnapshotSection, "openOrders">;
const LEGACY_SNAPSHOT_SECTIONS = PERFORMANCE_SNAPSHOT_SECTIONS.filter(
  (section): section is LegacySnapshotSection => section !== "openOrders"
);
export type PerformanceSnapshotValidation =
  | { status: "accepted" }
  | { status: "rejected"; error: string };

type SnapshotSectionPayload = BybitSnapshot[PerformanceSnapshotSection];

export interface PerformanceSnapshotBlobDocument {
  _id: string;
  schemaVersion: typeof PERFORMANCE_SNAPSHOT_BLOB_SCHEMA_VERSION;
  source: "bybit-v5";
  section: PerformanceSnapshotSection;
  createdAt: Date;
  payloadByteLength: number;
  payloadSha256: string;
  payload: SnapshotSectionPayload;
}

export interface PerformanceSnapshotSectionReference {
  blobId: string;
  payloadByteLength: number;
  payloadSha256: string;
  itemCount?: number;
}

export interface PerformanceSnapshotManifestDocument {
  _id: string;
  schemaVersion: 2 | typeof PERFORMANCE_SNAPSHOT_MANIFEST_SCHEMA_VERSION;
  source: "bybit-v5";
  environment: BybitSnapshot["environment"];
  serverTime: number;
  capturedAt: Date;
  receivedAt: Date;
  validation: PerformanceSnapshotValidation;
  sections: Record<LegacySnapshotSection, PerformanceSnapshotSectionReference> &
    Partial<Record<"openOrders", PerformanceSnapshotSectionReference>>;
}

export interface PerformanceSnapshotArchive {
  manifest: PerformanceSnapshotManifestDocument;
  blobs: PerformanceSnapshotBlobDocument[];
}

export interface PerformanceSnapshotArchiveResult {
  blobsCreated: number;
  blobsReused: number;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      if (record[key] !== undefined) result[key] = canonicalize(record[key]);
      return result;
    }, {});
}

function serializePayload(payload: SnapshotSectionPayload): string {
  const serialized = JSON.stringify(canonicalize(payload));
  if (serialized === undefined) throw new Error("Snapshot section could not be serialized");
  return serialized;
}

function buildBlob(
  section: PerformanceSnapshotSection,
  payload: SnapshotSectionPayload,
  createdAt: Date
): PerformanceSnapshotBlobDocument {
  const serialized = serializePayload(payload);
  const payloadSha256 = createHash("sha256").update(serialized).digest("hex");

  return {
    _id: `${section}:${payloadSha256}`,
    schemaVersion: PERFORMANCE_SNAPSHOT_BLOB_SCHEMA_VERSION,
    source: "bybit-v5",
    section,
    createdAt,
    payloadByteLength: Buffer.byteLength(serialized, "utf8"),
    payloadSha256,
    payload: JSON.parse(serialized) as SnapshotSectionPayload,
  };
}

function sectionReference(
  blob: PerformanceSnapshotBlobDocument
): PerformanceSnapshotSectionReference {
  return {
    blobId: blob._id,
    payloadByteLength: blob.payloadByteLength,
    payloadSha256: blob.payloadSha256,
    ...(Array.isArray(blob.payload) ? { itemCount: blob.payload.length } : {}),
  };
}

/** Build immutable section blobs and a lightweight per-run manifest. */
export function buildPerformanceSnapshotArchive(
  runId: string,
  snapshot: BybitSnapshot,
  receivedAt: Date,
  validation: PerformanceSnapshotValidation
): PerformanceSnapshotArchive {
  const blobs = PERFORMANCE_SNAPSHOT_SECTIONS.map((section) =>
    buildBlob(section, snapshot[section], receivedAt)
  );
  const sections = Object.fromEntries(
    blobs.map((blob) => [blob.section, sectionReference(blob)])
  ) as PerformanceSnapshotManifestDocument["sections"];
  const serverTime = Number(snapshot.serverTime);

  return {
    manifest: {
      _id: runId,
      schemaVersion: PERFORMANCE_SNAPSHOT_MANIFEST_SCHEMA_VERSION,
      source: "bybit-v5",
      environment: snapshot.environment,
      serverTime,
      capturedAt: Number.isFinite(serverTime) && serverTime > 0
        ? new Date(serverTime)
        : receivedAt,
      receivedAt,
      validation,
      sections,
    },
    blobs,
  };
}

function assertBlobIntegrity(
  blob: PerformanceSnapshotBlobDocument,
  reference: PerformanceSnapshotSectionReference,
  expectedSection: PerformanceSnapshotSection
) {
  const serialized = serializePayload(blob.payload);
  const checksum = createHash("sha256").update(serialized).digest("hex");
  const byteLength = Buffer.byteLength(serialized, "utf8");

  if (
    blob._id !== reference.blobId ||
    blob.section !== expectedSection ||
    blob.payloadSha256 !== reference.payloadSha256 ||
    checksum !== reference.payloadSha256 ||
    byteLength !== reference.payloadByteLength ||
    byteLength !== blob.payloadByteLength
  ) {
    throw new Error(`Archived ${expectedSection} snapshot blob failed integrity verification`);
  }
}

/** Persist blobs first, verify them, then commit the manifest that references them. */
export async function persistPerformanceSnapshotArchive(
  blobCollection: Collection<PerformanceSnapshotBlobDocument>,
  manifestCollection: Collection<PerformanceSnapshotManifestDocument>,
  archive: PerformanceSnapshotArchive
): Promise<PerformanceSnapshotArchiveResult> {
  let blobsCreated = 0;

  for (const blob of archive.blobs) {
    const result = await blobCollection.updateOne(
      { _id: blob._id },
      { $setOnInsert: blob },
      { upsert: true }
    );
    blobsCreated += result.upsertedCount;
  }

  const blobIds = archive.blobs.map((blob) => blob._id);
  const storedBlobs = await blobCollection.find({ _id: { $in: blobIds } }).toArray();
  const storedById = new Map(storedBlobs.map((blob) => [blob._id, blob]));

  for (const section of PERFORMANCE_SNAPSHOT_SECTIONS) {
    const reference = archive.manifest.sections[section];
    if (!reference) throw new Error(`Archived ${section} snapshot reference is missing`);
    const stored = storedById.get(reference.blobId);
    if (!stored) throw new Error(`Archived ${section} snapshot blob is missing`);
    assertBlobIntegrity(stored, reference, section);
  }

  await manifestCollection.insertOne(archive.manifest);

  return {
    blobsCreated,
    blobsReused: archive.blobs.length - blobsCreated,
  };
}

/** Reconstruct and verify the exact semantic snapshot referenced by a manifest. */
export function reconstructPerformanceSnapshot(
  manifest: PerformanceSnapshotManifestDocument,
  blobs: PerformanceSnapshotBlobDocument[]
): BybitSnapshot {
  const blobsById = new Map(blobs.map((blob) => [blob._id, blob]));
  const payloads = {} as Partial<Record<PerformanceSnapshotSection, SnapshotSectionPayload>>;
  const sections = manifest.schemaVersion === 2
    ? LEGACY_SNAPSHOT_SECTIONS
    : PERFORMANCE_SNAPSHOT_SECTIONS;

  for (const section of sections) {
    const reference = manifest.sections[section];
    if (!reference) throw new Error(`Archived ${section} snapshot reference is missing`);
    const blob = blobsById.get(reference.blobId);
    if (!blob) throw new Error(`Archived ${section} snapshot blob is missing`);
    assertBlobIntegrity(blob, reference, section);
    payloads[section] = JSON.parse(serializePayload(blob.payload)) as SnapshotSectionPayload;
  }

  return {
    environment: manifest.environment,
    serverTime: manifest.serverTime,
    apiKey: payloads.apiKey as BybitSnapshot["apiKey"],
    positions: payloads.positions as BybitSnapshot["positions"],
    executions: payloads.executions as BybitSnapshot["executions"],
    orders: payloads.orders as BybitSnapshot["orders"],
    openOrders: (payloads.openOrders ?? []) as BybitSnapshot["openOrders"],
    closedPnl: payloads.closedPnl as BybitSnapshot["closedPnl"],
  };
}

export async function loadPerformanceSnapshotArchive(
  runId: string,
  blobCollection: Collection<PerformanceSnapshotBlobDocument>,
  manifestCollection: Collection<PerformanceSnapshotManifestDocument>
): Promise<BybitSnapshot | null> {
  const manifest = await manifestCollection.findOne({ _id: runId });
  if (!manifest) return null;

  const sections = manifest.schemaVersion === 2
    ? LEGACY_SNAPSHOT_SECTIONS
    : PERFORMANCE_SNAPSHOT_SECTIONS;
  const blobIds = sections.map((section) => {
    const reference = manifest.sections[section];
    if (!reference) throw new Error(`Archived ${section} snapshot reference is missing`);
    return reference.blobId;
  });
  const blobs = await blobCollection.find({ _id: { $in: blobIds } }).toArray();
  return reconstructPerformanceSnapshot(manifest, blobs);
}
