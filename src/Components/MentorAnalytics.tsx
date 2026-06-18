"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { GA_ID, FB_PIXEL_ID, pageview } from "../lib/track";

// Loads GA4 + Meta Pixel and fires a page view on every route change.
// Mounted only in the mentor layout, so tracking is scoped to the Blueprint
// site (the apex portfolio is untracked). No-ops entirely when both IDs are
// unset, so dev/preview without env vars stays clean.
export default function MentorAnalytics() {
  const pathname = usePathname();
  const enabled = Boolean(GA_ID || FB_PIXEL_ID);
  // Seeded with the initial path: the snippets below already counted it, so we
  // skip it here. Comparing by value also ignores React Strict Mode's dev
  // double-invoke, firing only on genuine navigations.
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (!enabled || !pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;
    pageview(pathname);
  }, [pathname, enabled]);

  if (!enabled) return null;

  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}

      {FB_PIXEL_ID && (
        <>
          <Script id="fb-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${FB_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
