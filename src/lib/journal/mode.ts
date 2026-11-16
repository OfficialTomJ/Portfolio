import "server-only";
/** No request/query can enable this. Real-data activation is deliberately out of scope for mock v1. */
export function unifiedMockEnabled(): boolean {
  return process.env.JOURNAL_MODE === "unified-preview" &&
    (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview");
}
export const JOURNAL_MOCK_COLLECTION = "journal_v1_mock_workspaces";
export const JOURNAL_MOCK_KEY = "mock-v1-review";
