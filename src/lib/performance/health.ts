export const PERFORMANCE_STALE_AFTER_MS = 60 * 60 * 1000;

export function isPerformanceDatasetStale(
  lastSuccessAt: Date,
  now = new Date()
): boolean {
  return now.getTime() - lastSuccessAt.getTime() > PERFORMANCE_STALE_AFTER_MS;
}
