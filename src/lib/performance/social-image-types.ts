import type { Binary } from "mongodb";

export const PERFORMANCE_SOCIAL_IMAGE_COLLECTION = "performance_public_social_images";
export const PERFORMANCE_SOCIAL_IMAGE_SCHEMA_VERSION = 1;
export const PERFORMANCE_SOCIAL_IMAGE_RENDERER_VERSION = 1;

export type PerformanceSocialImageKind = "trade" | "journal";

export interface PerformanceSocialImageDocument {
  _id: string;
  schemaVersion: typeof PERFORMANCE_SOCIAL_IMAGE_SCHEMA_VERSION;
  rendererVersion: typeof PERFORMANCE_SOCIAL_IMAGE_RENDERER_VERSION;
  kind: PerformanceSocialImageKind;
  subjectId: string;
  contentType: "image/png";
  width: 1200;
  height: 630;
  createdAt: Date;
  legacyKeys?: string[];
  payloadByteLength: number;
  payloadSha256: string;
  payload: Binary;
}

export interface PerformanceSocialImageReference {
  publicKey: string;
  kind: PerformanceSocialImageKind;
  subjectId: string;
  width: 1200;
  height: 630;
  created: boolean;
}
