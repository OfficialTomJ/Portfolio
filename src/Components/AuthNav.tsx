"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";

export default function AuthNav() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <div className="w-28 h-8" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <Link
          href="/sign-in"
          className="text-[var(--bp-text-dim)] hover:text-white transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-md bg-[var(--bp-accent)] text-black font-semibold px-4 py-1.5 hover:brightness-110 transition-all"
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
    <div className="flex items-center gap-3 text-sm">
      <Link
        href="/blueprint"
        className="hidden sm:block text-[var(--bp-text-dim)] hover:text-white transition-colors"
      >
        My course
      </Link>
      <Link
        href="/account"
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
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
        className="text-[var(--bp-text-dim)] hover:text-white transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
