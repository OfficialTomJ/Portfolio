"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "../../../lib/auth-client";
import { AuthShell, Field } from "../../../Components/AuthUI";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get("token") ?? "";
  const error = params?.get("error");

  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [err, setErr] = useState("");

  if (error || !token) {
    return (
      <AuthShell title="Link expired">
        <p className="text-[var(--bp-text-dim)]">
          This password reset link is invalid or has expired. Request a new one
          from your account page.
        </p>
        <Link href="/sign-in" className="mt-6 inline-block text-[var(--bp-accent)] hover:underline">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErr("");
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setErr(error.message ?? "Could not reset password");
      setStatus("idle");
    } else {
      setStatus("done");
      setTimeout(() => router.push("/sign-in"), 1500);
    }
  }

  if (status === "done") {
    return (
      <AuthShell title="Password updated">
        <p className="text-[var(--bp-text-dim)]">
          Your password has been reset. Redirecting you to sign in…
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password">
      <form onSubmit={submit} className="space-y-3">
        <Field
          label="New password"
          value={password}
          onChange={setPassword}
          type="password"
          required
          minLength={8}
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-md bg-white text-black font-medium py-2.5 hover:bg-zinc-200 transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Set a new password"> </AuthShell>}>
      <ResetForm />
    </Suspense>
  );
}
