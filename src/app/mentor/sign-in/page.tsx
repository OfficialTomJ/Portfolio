"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FaGoogle } from "react-icons/fa";
import { authClient } from "../../../lib/auth-client";
import { AuthShell, Field, Divider } from "../../../Components/AuthUI";
import { authHref, safeAuthReturn } from "../../../lib/auth-return";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeAuthReturn(params?.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const { error } = await authClient.signIn.email({ email, password, callbackURL: returnTo });
      if (error) {
        if (error.status === 403) {
          router.push(authHref("/verify-email", returnTo));
          return;
        }
        setError(error.message ?? "Invalid email or password");
        setStatus("idle");
      } else {
        router.replace(returnTo);
        router.refresh();
      }
    } catch {
      setError("Could not sign in. Please try again.");
      setStatus("idle");
    }
  }

  async function google() {
    setStatus("loading");
    setError("");
    try {
      const { error } = await authClient.signIn.social({ provider: "google", callbackURL: returnTo, newUserCallbackURL: returnTo, errorCallbackURL: authHref("/sign-in", returnTo) });
      if (error) {
        setError(error.message ?? "Could not continue with Google");
        setStatus("idle");
      }
    } catch {
      setError("Could not continue with Google. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <AuthShell title="Sign in">
      <button
        onClick={google}
        disabled={status === "loading"}
        className="w-full flex items-center justify-center gap-2 rounded-md border border-[var(--bp-border-strong)] py-2.5 hover:bg-white/5 transition-colors"
      >
        <FaGoogle /> Continue with Google
      </button>
      <Divider />
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Email" value={email} onChange={setEmail} type="email" required />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          type="password"
          required
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-md bg-white text-black font-medium py-2.5 hover:bg-zinc-200 transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-sm text-[var(--bp-text-dim)]">
        New here?{" "}
        <Link href={authHref("/sign-up", returnTo)} className="text-[var(--bp-accent)] hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignInPage() {
  return <Suspense fallback={<AuthShell title="Sign in"> </AuthShell>}><SignInForm /></Suspense>;
}
