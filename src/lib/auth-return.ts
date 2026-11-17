export const DEFAULT_AUTH_RETURN = "/blueprint";

export type AuthPage = "/sign-in" | "/sign-up" | "/verify-email" | "/reset-password";

const authPages = new Set<string>(["/sign-in", "/sign-up", "/verify-email", "/reset-password"]);
const pageRoots = new Set(["portfolio", "blueprint", "dashboard", "account", "privacy", "compliance", "performance", "verify", "discord", "admin"]);
const localOrigin = "https://mentor.invalid";

function cleanPath(path: string) {
  return path.replace(/^\/mentor(?=\/|$)/, "") || "/";
}

/** Return only local page URLs, never auth loops, APIs or external destinations. */
export function safeAuthReturn(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return DEFAULT_AUTH_RETURN;
  const rawPath = value.split(/[?#]/, 1)[0];
  // Page slugs are ASCII. Reject encoded path separators/traversal entirely.
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(rawPath)) return DEFAULT_AUTH_RETURN;
  try {
    const url = new URL(value, localOrigin);
    const path = cleanPath(url.pathname);
    if (url.origin !== localOrigin || (path !== "/" && !pageRoots.has(path.split("/")[1]))) return DEFAULT_AUTH_RETURN;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_RETURN;
  }
}

export function authHref(page: AuthPage, returnTo: unknown = DEFAULT_AUTH_RETURN): string {
  return `${page}?${new URLSearchParams({ returnTo: safeAuthReturn(returnTo) })}`;
}

/** Switching auth screens must carry the original page, not the auth screen. */
export function authReturnFromLocation(location: string): string {
  try {
    const url = new URL(location, localOrigin);
    if (url.origin !== localOrigin) return DEFAULT_AUTH_RETURN;
    if (authPages.has(cleanPath(url.pathname))) return safeAuthReturn(url.searchParams.get("returnTo"));
    return safeAuthReturn(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return DEFAULT_AUTH_RETURN;
  }
}
