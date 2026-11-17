"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FiChevronDown, FiMenu, FiX } from "react-icons/fi";
import { authClient } from "../lib/auth-client";
import PortfolioLink from "./PortfolioLink";
import AuthLink from "./AuthLink";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const linkStyle = "min-h-11 items-center whitespace-nowrap rounded-md text-[var(--bp-text-dim)] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bp-accent)] aria-[current=page]:text-white";
const signupStyle = "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-[var(--bp-accent)] px-3 font-semibold text-black transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bp-accent)] sm:px-4";

export default function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  // Host rewrites can produce /mentor/* on the server and clean browser URLs.
  // Keep server/first-client markup stable; only the active marker waits.
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const path = mounted ? pathname?.replace(/^\/mentor(?=\/|$)/, "") || "/" : "";
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const courseHref = user ? "/blueprint" : "/";
  const mobileCourseLabel = "The Blueprint. (free course)";
  const courseActive = path === "/" || path === "/blueprint" || path.startsWith("/blueprint/");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLDetailsElement>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const menuKey = `${pathname}:${user?.id ?? ""}`;
  const menuOpen = openMenuKey === menuKey;
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const closeMenus = () => {
    setOpenMenuKey(null);
    if (accountRef.current) accountRef.current.open = false;
  };

  useEffect(() => {
    if (accountRef.current) accountRef.current.open = false;
  }, [pathname, user?.id]);

  useEffect(() => {
    function dismissAccount(event: PointerEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        accountRef.current.open = false;
      }
      if (!menuRef.current?.contains(event.target as Node) && !menuButtonRef.current?.contains(event.target as Node)) {
        setOpenMenuKey(null);
      }
    }
    function escapeAccount(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.dataset.open === "true") {
        setOpenMenuKey(null);
        menuButtonRef.current?.focus();
      }
      if (event.key === "Escape" && accountRef.current?.open) {
        accountRef.current.open = false;
        accountRef.current.querySelector("summary")?.focus();
      }
    }
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeMobileOnDesktop = () => {
      if (desktop.matches) setOpenMenuKey(null);
    };
    const closeMobileOnHistory = () => setOpenMenuKey(null);
    document.addEventListener("pointerdown", dismissAccount);
    document.addEventListener("keydown", escapeAccount);
    desktop.addEventListener("change", closeMobileOnDesktop);
    window.addEventListener("popstate", closeMobileOnHistory);
    return () => {
      document.removeEventListener("pointerdown", dismissAccount);
      document.removeEventListener("keydown", escapeAccount);
      desktop.removeEventListener("change", closeMobileOnDesktop);
      window.removeEventListener("popstate", closeMobileOnHistory);
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      closeMenus();
      router.push("/");
      router.refresh();
    } catch {
      setSignOutError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  const displayName = user?.name?.split(" ")[0] || "Account";
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();
  const avatar = user?.image ? (
    <Image src={user.image} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" />
  ) : (
    <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--bp-accent)] text-xs font-semibold text-black">{initial}</span>
  );

  return (
    <div
      className="flex min-w-0 items-center gap-3 text-xs sm:gap-5 sm:text-sm"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpenMenuKey(null);
      }}
    >
      <div className="flex items-center gap-5 sm:gap-6">
        <PortfolioLink placement="header" aria-current={path === "/portfolio" ? "page" : undefined} className={`${linkStyle} inline-flex font-medium`}>Portfolio</PortfolioLink>
        <Link href={courseHref} aria-current={courseActive ? "page" : undefined} className={`${linkStyle} hidden md:inline-flex`}>The Blueprint.</Link>
        <Link href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined} className={`${linkStyle} hidden md:inline-flex`}>TJSS</Link>
      </div>

      {isPending ? (
        <span className="hidden h-7 w-24 md:block" aria-hidden="true" />
      ) : user ? (
        <details ref={accountRef} className="relative hidden md:block">
          <summary aria-label="Account menu" className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bp-accent)] [&::-webkit-details-marker]:hidden">
            {avatar}<span className="max-w-28 truncate">{displayName}</span><FiChevronDown aria-hidden="true" className="text-zinc-500" />
          </summary>
          <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--bp-border-strong)] bg-[#101012] p-2 shadow-xl">
            <Link href="/account" onClick={closeMenus} className={`${linkStyle} flex w-full px-3`}>Account settings</Link>
            <button type="button" disabled={signingOut} onClick={signOut} className={`${linkStyle} flex w-full px-3 disabled:opacity-50`}>{signingOut ? "Signing out…" : "Sign out"}</button>
            {signOutError && <p role="alert" className="px-3 py-2 text-xs text-amber-200">{signOutError}</p>}
          </div>
        </details>
      ) : (
        <div className="flex items-center gap-4">
          <AuthLink to="/sign-in" className={`${linkStyle} hidden md:inline-flex`}>Log in</AuthLink>
          <AuthLink to="/sign-up" className={signupStyle}>Sign up free</AuthLink>
        </div>
      )}

      {user && <Link href="/account" aria-label="Account settings" className="inline-flex min-h-11 min-w-7 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bp-accent)] md:hidden">{avatar}</Link>}
      <button
        ref={menuButtonRef}
        type="button"
        aria-controls="mentor-mobile-menu"
        aria-expanded={menuOpen}
        onClick={() => setOpenMenuKey(menuOpen ? null : menuKey)}
        className={`${linkStyle} inline-flex gap-1.5 md:hidden`}
      >
        <span aria-hidden="true" className="relative h-4 w-4">
          <FiMenu className={`absolute inset-0 h-4 w-4 transition-all duration-200 motion-reduce:transition-none ${menuOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`} />
          <FiX className={`absolute inset-0 h-4 w-4 transition-all duration-200 motion-reduce:transition-none ${menuOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`} />
        </span>Menu
      </button>

      <div
        ref={menuRef}
        id="mentor-mobile-menu"
        data-open={menuOpen}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        className="bp-mobile-nav absolute inset-x-0 top-full grid md:hidden"
      >
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-b border-[var(--bp-border-strong)] bg-black px-4 pb-4 pt-2 sm:px-6">
            <nav aria-label="Mobile navigation" className="flex flex-col text-sm">
              <PortfolioLink placement="mobile_menu" onClick={closeMenus} aria-current={path === "/portfolio" ? "page" : undefined} className={`${linkStyle} flex px-3 font-medium`}>Portfolio</PortfolioLink>
              <Link href={courseHref} onClick={closeMenus} aria-current={courseActive ? "page" : undefined} className={`${linkStyle} flex px-3`}>{mobileCourseLabel}</Link>
              <Link href="/dashboard" onClick={closeMenus} aria-current={path === "/dashboard" ? "page" : undefined} className={`${linkStyle} flex px-3`}>TJSS Dashboard</Link>
            </nav>
            <div className="mt-2 flex flex-col border-t border-[var(--bp-border)] pt-2 text-sm" aria-busy={isPending}>
              {isPending ? <p className="px-3 py-3 text-[var(--bp-text-dim)]">Loading account…</p> : user ? <>
                <Link href="/account" onClick={closeMenus} className={`${linkStyle} flex px-3`}>Account settings</Link>
                <button type="button" disabled={signingOut} onClick={signOut} className={`${linkStyle} flex px-3 disabled:opacity-50`}>{signingOut ? "Signing out…" : "Sign out"}</button>
                {signOutError && <p role="alert" className="px-3 py-2 text-xs text-amber-200">{signOutError}</p>}
              </> : <>
                <AuthLink to="/sign-in" onClick={closeMenus} className={`${linkStyle} flex px-3`}>Log in</AuthLink>
                <AuthLink to="/sign-up" onClick={closeMenus} className={`${linkStyle} flex px-3`}>Sign up free</AuthLink>
              </>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
