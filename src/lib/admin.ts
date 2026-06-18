import "server-only";

// Minimal admin gate for the creator dashboard. No DB role model — for a solo
// creator, an allowlist of emails in ADMIN_EMAILS (comma-separated) is enough.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

type SessionLike = { user?: { email?: string | null } } | null;

/** True if the session belongs to an allowlisted admin email. */
export function isAdmin(session: SessionLike): boolean {
  const email = session?.user?.email?.toLowerCase();
  return !!email && ADMIN_EMAILS.includes(email);
}
