"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "../../../lib/auth-client";
import { AuthShell, Field } from "../../../Components/AuthUI";
import { authHref, safeAuthReturn } from "../../../lib/auth-return";

function VerifyEmailForm() {
  const params = useSearchParams();
  const returnTo = safeAuthReturn(params?.get("returnTo"));
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState("");

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const { error } = await authClient.sendVerificationEmail({ email, callbackURL: returnTo });
      if (error) {
        setError(error.message ?? "Could not send verification email");
        setStatus("idle");
      } else setStatus("sent");
    } catch {
      setError("Could not send verification email. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <AuthShell title="Verify your email">
      <p className="text-[var(--bp-text-dim)] mb-5">
        Please confirm your email address to continue. Check your inbox
        for the verification link, or resend it below.
      </p>
      {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}
      {status === "sent" ? (
        <p className="text-sm text-[var(--bp-accent)]">
          Verification email sent. Check your inbox.
        </p>
      ) : (
        <form onSubmit={resend} className="space-y-3">
          <Field label="Email" value={email} onChange={setEmail} type="email" required />
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-md bg-white text-black font-medium py-2.5 hover:bg-zinc-200 transition-colors disabled:opacity-60"
          >
            {status === "loading" ? "Sending…" : "Resend verification email"}
          </button>
        </form>
      )}
      <Link
        href={authHref("/sign-in", returnTo)}
        className="mt-6 inline-block text-[var(--bp-accent)] hover:underline"
      >
        Back to sign in
      </Link>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<AuthShell title="Verify your email"> </AuthShell>}><VerifyEmailForm /></Suspense>;
}
