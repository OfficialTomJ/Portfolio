"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaGoogle } from "react-icons/fa";
import { authClient } from "../../../lib/auth-client";
import { AuthShell, Field, Divider } from "../../../Components/AuthUI";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/blueprint",
    });
    if (error) {
      // Surface the unverified-email case clearly.
      if (error.status === 403) {
        router.push("/verify-email");
        return;
      }
      setError(error.message ?? "Invalid email or password");
      setStatus("idle");
    } else {
      router.push("/blueprint");
    }
  }

  async function google() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/blueprint" });
  }

  return (
    <AuthShell title="Sign in">
      <button
        onClick={google}
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
        <Link href="/sign-up" className="text-[var(--bp-accent)] hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
