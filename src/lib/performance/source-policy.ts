/** Retired account ingestion. Public, unauthenticated chart proxies are separate. */
export function rejectBybitAccountAccess(): void {
  throw new Error("Bybit account access is retired. Use stored history or upload a Breakout CSV in admin.");
}
