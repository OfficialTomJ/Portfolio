export interface BybitApiKeyInfo {
  userID: number;
  readOnly: number;
  deadlineDay?: number;
  expiredAt?: string;
}

/** Keep only account fields required by the sync pipeline and key-rotation checks. */
export function sanitizeBybitApiKeyInfo(
  value: BybitApiKeyInfo & Record<string, unknown>
): BybitApiKeyInfo {
  return {
    userID: value.userID,
    readOnly: value.readOnly,
    ...(typeof value.deadlineDay === "number" ? { deadlineDay: value.deadlineDay } : {}),
    ...(typeof value.expiredAt === "string" ? { expiredAt: value.expiredAt } : {}),
  };
}
