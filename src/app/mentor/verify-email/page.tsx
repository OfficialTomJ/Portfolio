"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "../../../lib/auth-client";
import { AuthShell, Field } from "../../../Components/AuthUI";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    await authClient.sendVerificationEmail({ email, callbackURL: "/blueprint" });
    setStatus("sent");
  }

  return (
    <AuthShell title="Verify your email">
      <p className="text-[var(--bp-text-dim)] mb-5">
        Please confirm your email address to access the course. Check your inbox
        for the verification link — or resend it below.
      </p>
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
        href="/sign-in"
        className="mt-6 inline-block text-[var(--bp-accent)] hover:underline"
      >
        Back to sign in
      </Link>
    </AuthShell>
  );
}
