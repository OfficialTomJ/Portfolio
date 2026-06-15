"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Minimal top loading bar: trickles up on internal navigation, pulses in the
// accent colour, then completes when the new route renders.
export default function TopProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  function start() {
    if (running.current) return;
    running.current = true;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setActive(true);
    setProgress(8);
    trickle.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(0.5, (90 - p) * 0.08) : p));
    }, 200);
  }

  function done() {
    if (!running.current) return;
    running.current = false;
    if (trickle.current) clearInterval(trickle.current);
    setProgress(100);
    hideTimer.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 350);
  }

  // Start on internal link clicks + back/forward.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.getAttribute("target") === "_blank")
        return;
      try {
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.search === location.search)
          return;
      } catch {
        return;
      }
      start();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, []);

  // Complete when the path actually changes.
  useEffect(() => {
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!active) return null;

  return (
    <div className="bp-topbar-wrap" aria-hidden>
      <div className="bp-topbar" style={{ width: `${progress}%` }} />
    </div>
  );
}
