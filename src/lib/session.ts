import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "./auth";

// ---------------------------------------------------------------------------
// Local development access.
//
// On localhost, gated routes (/blueprint, /dashboard, /admin and the
// /api/tjss/* endpoints) resolve to a synthetic verified member so the app can
// be worked on without a login round-trip every time.
//
// This CANNOT activate in a deployed build: NODE_ENV is "development" only
// under `next dev`. Both `next build`/`next start` and every Vercel build set
// it to "production", where this module falls through to real Better Auth.
//
// Opt out with DEV_REAL_AUTH=1 in .env.local when you need to exercise the
// real sign-in flow or check what a signed-out visitor sees.
//
// DEV_FAKE_SESSION optionally picks who you are: an email address impersonates
// that member; unset (or "1") uses the first ADMIN_EMAILS address.
// ---------------------------------------------------------------------------
const IS_DEV = process.env.NODE_ENV === "development";
const DEV_BYPASS = IS_DEV && process.env.DEV_REAL_AUTH !== "1";

if (DEV_BYPASS) {
  console.warn(
    "[session] DEV BYPASS ACTIVE, all gated routes are open on localhost. " +
      "Set DEV_REAL_AUTH=1 in .env.local to use real authentication."
  );
}

function devSession() {
  const flag = process.env.DEV_FAKE_SESSION;
  const email =
    flag && flag !== "1"
      ? flag
      : (process.env.ADMIN_EMAILS ?? "dev@example.com").split(",")[0].trim();

  const now = new Date();
  return {
    session: {
      id: "dev-session",
      userId: "dev-user",
      token: "dev-session-token",
      expiresAt: new Date(Date.now() + 864e5),
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: "dev-user",
      email,
      name: "Dev User",
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/** Returns the current Better Auth session (or null) on the server. */
export async function getSession() {
  if (DEV_BYPASS) return devSession() as never;
  return auth.api.getSession({ headers: await headers() });
}

export type MemberSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * The single definition of "is this a member?", a signed-in, email-verified
 * account. Blueprint course pages and the TJSS dashboard share it deliberately:
 * the dashboard ships as part of the course, so the two gates must not drift.
 *
 * Returns the session, or null for anyone who should see <AccessGate />.
 */
export async function getMemberSession(): Promise<MemberSession | null> {
  const session = await getSession();
  return session?.user?.emailVerified ? session : null;
}

/**
 * Route-handler counterpart to `getMemberSession`. Returns either the session
 * or the 401 to return immediately:
 *
 *   const gate = await requireMemberApi();
 *   if (gate instanceof NextResponse) return gate;
 */
export async function requireMemberApi(): Promise<MemberSession | NextResponse> {
  const session = await getMemberSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
