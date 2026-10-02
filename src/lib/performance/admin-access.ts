import "server-only";

import { isAdmin } from "@/lib/admin";
import { getSession } from "@/lib/session";
import type { NextRequest } from "next/server";

/** Compare the browser origin with the request host, including dev servers bound to 0.0.0.0. */
export function isSameOriginAdminRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.host === request.headers.get("host") && url.protocol === request.nextUrl.protocol;
  } catch { return false; }
}

/** The creator-only gate for private journal views and manual sync. */
export async function getPerformanceAdminSession() {
  const session = await getSession();
  return session?.user?.emailVerified && isAdmin(session) ? session : null;
}
