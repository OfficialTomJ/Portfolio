import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";

/** Returns the current Better Auth session (or null) on the server. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
