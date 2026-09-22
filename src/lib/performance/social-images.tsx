import "server-only";

import { createHash } from "node:crypto";
import { Binary } from "mongodb";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { getDb } from "@/lib/mongodb";
import { getHistoricalCandles } from "./market";
import { buildPerformanceView, sydneyYear } from "./metrics";
import { PerformanceOpenGraphCard, TradeOpenGraphCard } from "./og";
import {
  journalLegacyImageKey,
  journalSocialImageKey,
  legacyJournalImageVersion,
  tradeLegacyImageKey,
  tradeSocialImageKey,
} from "./social-image-keys";
import {
  PERFORMANCE_SOCIAL_IMAGE_COLLECTION,
  PERFORMANCE_SOCIAL_IMAGE_RENDERER_VERSION,
  PERFORMANCE_SOCIAL_IMAGE_SCHEMA_VERSION,
  type PerformanceSocialImageDocument,
  type PerformanceSocialImageKind,
  type PerformanceSocialImageReference,
} from "./social-image-types";
import type { PerformanceDataset, PerformanceTrade, PerformanceView } from "./types";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function imageCollection() {
  return getDb().collection<PerformanceSocialImageDocument>(
    PERFORMANCE_SOCIAL_IMAGE_COLLECTION
  );
}

function sha256(payload: Buffer): string {
  return createHash("sha256").update(payload).digest("hex");
}

function validatePng(payload: Buffer) {
  if (payload.length === 0 || payload.length > MAX_IMAGE_BYTES) {
    throw new Error("Generated performance image has an unsafe size");
  }
  if (!payload.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("Generated performance image is not a valid PNG");
  }
}

function reference(
  document: Pick<PerformanceSocialImageDocument, "_id" | "kind" | "subjectId" | "width" | "height">,
  created: boolean
): PerformanceSocialImageReference {
  return {
    publicKey: document._id,
    kind: document.kind,
    subjectId: document.subjectId,
    width: document.width,
    height: document.height,
    created,
  };
}

async function addLegacyKeys(publicKey: string, legacyKeys: string[]) {
  if (!legacyKeys.length) return;
  await imageCollection().updateOne(
    { _id: publicKey },
    { $addToSet: { legacyKeys: { $each: legacyKeys } } }
  );
}

async function findReference(
  publicKey: string,
  legacyKeys: string[] = []
): Promise<PerformanceSocialImageReference | null> {
  const stored = await imageCollection().findOne(
    { _id: publicKey },
    {
      projection: {
        _id: 1,
        kind: 1,
        subjectId: 1,
        width: 1,
        height: 1,
        legacyKeys: 1,
      },
    }
  );
  if (!stored) return null;
  const existingLegacyKeys = new Set(stored.legacyKeys ?? []);
  const missingLegacyKeys = legacyKeys.filter((key) => !existingLegacyKeys.has(key));
  await addLegacyKeys(publicKey, missingLegacyKeys);
  return reference(stored, false);
}

async function renderPng(element: ReactElement): Promise<Buffer> {
  const response = new ImageResponse(element, { width: 1200, height: 630 });
  const payload = Buffer.from(await response.arrayBuffer());
  validatePng(payload);
  return payload;
}

async function persistImage(input: {
  publicKey: string;
  kind: PerformanceSocialImageKind;
  subjectId: string;
  payload: Buffer;
  legacyKeys?: string[];
}): Promise<PerformanceSocialImageReference> {
  validatePng(input.payload);
  const document: PerformanceSocialImageDocument = {
    _id: input.publicKey,
    schemaVersion: PERFORMANCE_SOCIAL_IMAGE_SCHEMA_VERSION,
    rendererVersion: PERFORMANCE_SOCIAL_IMAGE_RENDERER_VERSION,
    kind: input.kind,
    subjectId: input.subjectId,
    contentType: "image/png",
    width: 1200,
    height: 630,
    createdAt: new Date(),
    legacyKeys: [],
    payloadByteLength: input.payload.length,
    payloadSha256: sha256(input.payload),
    payload: new Binary(input.payload),
  };
  const result = await imageCollection().updateOne(
    { _id: document._id },
    { $setOnInsert: document },
    { upsert: true }
  );
  await addLegacyKeys(document._id, input.legacyKeys ?? []);
  const stored = await imageCollection().findOne({ _id: document._id });
  if (!stored) throw new Error("Stored performance image could not be read back");
  assertStoredImageIntegrity(stored);
  return reference(stored, result.upsertedCount === 1);
}

export function assertStoredImageIntegrity(document: PerformanceSocialImageDocument): Buffer {
  if (
    document.schemaVersion !== PERFORMANCE_SOCIAL_IMAGE_SCHEMA_VERSION ||
    document.rendererVersion !== PERFORMANCE_SOCIAL_IMAGE_RENDERER_VERSION ||
    document.contentType !== "image/png" ||
    document.width !== 1200 ||
    document.height !== 630
  ) {
    throw new Error(`Stored performance image ${document._id} has invalid metadata`);
  }
  const payload = Buffer.from(document.payload.buffer);
  validatePng(payload);
  if (
    payload.length !== document.payloadByteLength ||
    sha256(payload) !== document.payloadSha256
  ) {
    throw new Error(`Stored performance image ${document._id} failed integrity verification`);
  }
  return payload;
}

export async function ensureTradeSocialImage(
  trade: PerformanceTrade
): Promise<PerformanceSocialImageReference> {
  const publicKey = tradeSocialImageKey(trade);
  const legacyKeys = [tradeLegacyImageKey(trade.id)];
  const existing = await findReference(publicKey, legacyKeys);
  if (existing) return existing;

  const candles = await getHistoricalCandles(trade, "1h");
  if (!candles.length) {
    throw new Error(`Market candles unavailable for ${trade.id}; image was not persisted`);
  }
  const payload = await renderPng(<TradeOpenGraphCard trade={trade} candles={candles} />);
  return persistImage({
    publicKey,
    kind: "trade",
    subjectId: trade.id,
    payload,
    legacyKeys,
  });
}

export async function ensureJournalSocialImage(
  dataset: PerformanceDataset,
  suppliedView?: PerformanceView
): Promise<PerformanceSocialImageReference> {
  const view = suppliedView ?? buildPerformanceView(dataset, "YTD", sydneyYear(dataset.asOf));
  const publicKey = journalSocialImageKey(dataset, view);
  const legacyKeys = [journalLegacyImageKey(legacyJournalImageVersion(view))];
  const existing = await findReference(publicKey, legacyKeys);
  if (existing) return existing;

  const payload = await renderPng(<PerformanceOpenGraphCard dataset={dataset} view={view} />);
  return persistImage({
    publicKey,
    kind: "journal",
    subjectId: publicKey,
    payload,
    legacyKeys,
  });
}

export async function loadStoredSocialImage(
  publicKey: string
): Promise<PerformanceSocialImageDocument | null> {
  const document = await imageCollection().findOne({ _id: publicKey });
  if (document) assertStoredImageIntegrity(document);
  return document;
}

export async function loadStoredSocialImageByLegacyKey(
  legacyKey: string
): Promise<PerformanceSocialImageDocument | null> {
  const document = await imageCollection().findOne(
    { legacyKeys: legacyKey },
    { sort: { createdAt: -1 } }
  );
  if (document) assertStoredImageIntegrity(document);
  return document;
}

export function storedSocialImageResponse(
  document: PerformanceSocialImageDocument,
  cacheControl = "public, max-age=31536000, immutable"
): Response {
  const payload = assertStoredImageIntegrity(document);
  return new Response(new Uint8Array(payload), {
    headers: {
      "Content-Type": document.contentType,
      "Content-Length": String(document.payloadByteLength),
      "Cache-Control": cacheControl,
      "CDN-Cache-Control": cacheControl,
      "Vercel-CDN-Cache-Control": cacheControl,
      ETag: `"${document.payloadSha256}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
