"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore, type ComponentProps } from "react";
import { authHref, authReturnFromLocation, type AuthPage } from "../lib/auth-return";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
  };
}
const browserLocation = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
const serverLocation = () => "";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & {
  to: AuthPage;
  returnTo?: string;
};

export default function AuthLink({ to, returnTo, ...props }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const location = useSyncExternalStore(subscribe, browserLocation, serverLocation);
  const destination = returnTo ?? authReturnFromLocation(location || pathname || "/blueprint");
  return (
    <Link
      {...props}
      href={authHref(to, destination)}
      onNavigate={(event) => {
        event.preventDefault();
        // Capture query/hash at the click, including query-only client navigation.
        router.push(authHref(to, returnTo ?? authReturnFromLocation(browserLocation())));
      }}
    />
  );
}
