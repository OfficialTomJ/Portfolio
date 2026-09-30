import "server-only";

import { isAdmin } from "@/lib/admin";
import { getSession } from "@/lib/session";

/** The creator-only gate for private journal views and manual sync. */
export async function getPerformanceAdminSession() {
  const session = await getSession();
  return session?.user?.emailVerified && isAdmin(session) ? session : null;
}
