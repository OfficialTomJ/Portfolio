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

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const url = req.nextUrl.clone();
  const { pathname } = url;

  if (isMentorHost(host) || DEV_AS_MENTOR) {
    // API routes live at /api/* for both hosts — don't prefix them.
    if (pathname.startsWith("/api") || pathname.startsWith("/mentor")) {
      return NextResponse.next();
    }
    url.pathname = pathname === "/" ? "/mentor" : `/mentor${pathname}`;
    return NextResponse.rewrite(url);
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
