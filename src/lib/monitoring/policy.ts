export const SYNC_MAX_AGE_MS = 45 * 60_000;
export const IMAGE_GRACE_MS = 60 * 60_000;

export type HealthResult = {
  status: "healthy" | "waiting" | "failed";
  reason: string;
  counts?: Record<string, number>;
};

export function syncHealth(input: {
  environment: string; expectedEnvironment: string;
  lastSuccessAt?: Date; completedAt?: Date; runStatus?: string;
  sourceAccountId?: string; expectedAccountId?: string;
}, now: Date): HealthResult {
  if (input.environment !== input.expectedEnvironment || !input.sourceAccountId ||
    input.expectedAccountId && input.sourceAccountId !== input.expectedAccountId) {
    return { status: "failed", reason: "sync_account_mismatch" };
  }
  if (input.runStatus !== "succeeded" || !input.lastSuccessAt || !input.completedAt) {
    return { status: "failed", reason: "no_completed_sync" };
  }
  const ages = [input.lastSuccessAt, input.completedAt].map(date => now.getTime() - date.getTime());
  if (ages.some(age => !Number.isFinite(age) || age < -300_000)) {
    return { status: "failed", reason: "invalid_sync_timestamp" };
  }
  if (ages.some(age => age > SYNC_MAX_AGE_MS)) return { status: "failed", reason: "sync_overdue" };
  return { status: "healthy", reason: "completed_sync_recent" };
}

export function imageCoverageHealth(required: { key: string; changedAt?: Date }[],
  present: Set<string>, corrupt: number, now: Date): HealthResult {
  const missing = required.filter(image => !present.has(image.key));
  const counts = { required: required.length, present: required.length - missing.length, missing: missing.length, corrupt };
  if (corrupt) return { status: "failed", reason: "image_integrity_failed", counts };
  if (missing.some(image => !image.changedAt || !Number.isFinite(image.changedAt.getTime()) ||
    image.changedAt.getTime() > now.getTime() + 300_000 || now.getTime() - image.changedAt.getTime() > IMAGE_GRACE_MS)) {
    return { status: "failed", reason: "required_images_missing", counts };
  }
  if (missing.length) return { status: "waiting", reason: "images_within_publication_grace", counts };
  return { status: "healthy", reason: "required_images_valid", counts };
}
