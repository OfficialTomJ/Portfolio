// Client-side analytics helpers for the mentor app (GA4 + Meta Pixel).
// Safe to import anywhere on the client: every call no-ops if the relevant
// script hasn't loaded (e.g. env IDs unset, or before scripts hydrate).

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

// Meta standard events fire via `track`; anything else via `trackCustom`.
const FB_STANDARD_EVENTS = new Set([
  "PageView",
  "Lead",
  "CompleteRegistration",
  "ViewContent",
  "Contact",
  "Subscribe",
]);

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
    dataLayer?: unknown[];
  }
}

/** Record a page view on both GA4 and the Meta Pixel. */
export function pageview(url: string) {
  if (typeof window === "undefined") return;
  if (GA_ID && window.gtag) {
    window.gtag("event", "page_view", { page_path: url });
  }
  if (FB_PIXEL_ID && window.fbq) {
    window.fbq("track", "PageView");
  }
}

/** Record a named event (e.g. a conversion) on both GA4 and the Meta Pixel. */
export function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (GA_ID && window.gtag) {
    window.gtag("event", name, params);
  }
  if (FB_PIXEL_ID && window.fbq) {
    window.fbq(FB_STANDARD_EVENTS.has(name) ? "track" : "trackCustom", name, params);
  }
}
