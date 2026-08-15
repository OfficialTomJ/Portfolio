// Self-expiring "new feature" flags.
//
// A hardcoded NEW badge is a lie with a delay: it survives until someone
// remembers to delete it, which is never. Gating every badge on one date means
// they all disappear together, on their own.
//
// Safe in both server and client components: no imports, pure date maths.

/** How long a feature is announced as new. */
const NEW_FOR_DAYS = 30;

/** Launch date of the TJSS dashboard (ISO, UTC). */
export const DASHBOARD_LAUNCHED = "2026-08-15";

function isWithinWindow(isoDate: string, days: number): boolean {
  const launched = Date.parse(isoDate);
  if (Number.isNaN(launched)) return false;
  const age = Date.now() - launched;
  return age >= 0 && age < days * 86_400_000;
}

/** True while the dashboard should still be flagged as new. */
export function isDashboardNew(): boolean {
  return isWithinWindow(DASHBOARD_LAUNCHED, NEW_FOR_DAYS);
}
