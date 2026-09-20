"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";
import { isDashboardNew } from "../lib/whats-new";

export default function AuthNav() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <div className="w-28 h-8" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-xs sm:gap-4 sm:text-sm">
        <Link
          href="/sign-in"
          className="whitespace-nowrap text-[var(--bp-text-dim)] transition-colors hover:text-white"
        >
          Log in
        </Link>
        <Link
          href="/sign-up"
          className="whitespace-nowrap rounded-md bg-[var(--bp-accent)] px-3 py-1.5 font-semibold text-black transition-all hover:brightness-110 sm:px-4"
        >
          Sign up free
        </Link>
      </div>
    );
  }

  const { name, email, image } = session.user;
  const displayName = name?.split(" ")[0] || email;
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs sm:gap-3 sm:text-sm">
      <Link
        href="/blueprint"
        className="hidden whitespace-nowrap text-[var(--bp-text-dim)] transition-colors hover:text-white sm:block"
      >
        My course
      </Link>
      {/* Visible on mobile too. This was the only route to the dashboard and it
          did not exist below sm. The dot expires with isDashboardNew(). */}
      <Link
        href="/dashboard"
        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[var(--bp-text-dim)] transition-colors hover:text-white"
      >
        <span className="sm:hidden">TJSS</span>
        <span className="hidden sm:inline">Dashboard</span>
        {isDashboardNew() && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--bp-accent)]"
            aria-label="New"
          />
        )}
      </Link>
      <Link
        href="/performance"
        className="shrink-0 whitespace-nowrap text-[var(--bp-text-dim)] transition-colors hover:text-white"
      >
        <span className="sm:hidden">Journal</span>
        <span className="hidden sm:inline">Performance</span>
      </Link>
      <Link
        href="/account"
        className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
        title="Account settings"
      >
        {image ? (
          <Image
            src={image}
            alt=""
            width={28}
            height={28}
            style={{ width: 28, height: 28 }}
            className="rounded-full object-cover shrink-0"
          />
        ) : (
          <span className="grid place-items-center w-7 h-7 rounded-full bg-[var(--bp-accent)] text-black text-xs font-semibold">
            {initial}
          </span>
        )}
        <span className="hidden sm:block max-w-[120px] truncate">{displayName}</span>
      </Link>
      <button
        onClick={async () => {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        }}
        className="hidden whitespace-nowrap text-[var(--bp-text-dim)] transition-colors hover:text-white min-[420px]:block"
      >
        Sign out
      </button>
    </div>
  );
}
