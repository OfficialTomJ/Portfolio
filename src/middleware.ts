import { NextRequest, NextResponse } from "next/server";

// Subdomain routing for the mentoring platform.
//
// mentor.thomas-johnston.com/*  ->  internally rewritten to /mentor/*
//   so the mentor app's URLs stay clean (/, /blueprint, ...).
// On the apex/www host, the physical /mentor/* paths are hidden (404).
//
// Local dev: use http://mentor.localhost:3000 (Chrome resolves *.localhost).
//
// NOTE: the auth gate for /blueprint* is added in the auth phase.

function isMentorHost(host: string): boolean {
  return host.startsWith("mentor.");
}

// Local dev: Google OAuth rejects *.localhost, so set DEV_AS_MENTOR=1 to serve
// the mentor app on plain http://localhost:3000 (where Google OAuth works).
const DEV_AS_MENTOR = process.env.DEV_AS_MENTOR === "1";
// Branch previews do not have the mentor.* custom domain, so treat Vercel's
// preview hostname as the mentor app. Production remains host-gated.
const VERCEL_PREVIEW = process.env.VERCEL_ENV === "preview";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const url = req.nextUrl.clone();
  const { pathname } = url;
  const portfolioReview = (VERCEL_PREVIEW || process.env.NODE_ENV === "development") && process.env.BTC_PORTFOLIO_MODE === "database";
  if (portfolioReview && (pathname === "/performance" || pathname.startsWith("/performance/") || pathname === "/mentor/performance" || pathname.startsWith("/mentor/performance/"))) {
    const destination = req.nextUrl.clone(); destination.pathname = "/portfolio"; destination.search = "";
    return NextResponse.redirect(destination);
  }
  if (portfolioReview && (pathname === "/api/performance" || pathname.startsWith("/api/performance/") || pathname === "/api/spot" || pathname.startsWith("/api/spot/"))) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  const privateReview = pathname.startsWith("/api/btc-portfolio/workspace") || pathname.startsWith("/api/btc-portfolio/admin") || pathname.startsWith("/api/performance/admin/") || pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/mentor/admin" || pathname.startsWith("/mentor/admin/") || pathname.startsWith("/api/spot/admin") || pathname === "/api/spot/instruments" || pathname === "/performance/review" ||
    pathname.startsWith("/performance/review/") ||
    pathname === "/mentor/performance/review" ||
    pathname.startsWith("/mentor/performance/review/");

  function withPrivateHeaders(response: NextResponse) {
    if (privateReview) {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return response;
  }

  if (isMentorHost(host) || DEV_AS_MENTOR || VERCEL_PREVIEW) {
    // API routes live at /api/* for both hosts, don't prefix them.
    if (pathname.startsWith("/api") || pathname.startsWith("/mentor")) {
      return withPrivateHeaders(NextResponse.next());
    }
    // Next can normalise nextUrl's host to localhost behind a proxy. Preserve
    // the incoming host so this remains an internal rewrite, not a second
    // request to the apex host that would reject the physical /mentor path.
    url.host = host;
    url.pathname = pathname === "/" ? "/mentor" : `/mentor${pathname}`;
    return withPrivateHeaders(NextResponse.rewrite(url));
  }

  // Apex/other hosts: keep the mentor route group private.
  if (pathname === "/mentor" || pathname.startsWith("/mentor/")) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
