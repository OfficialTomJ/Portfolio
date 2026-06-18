"use client";

import { useState } from "react";
import Link from "next/link";
import { FaGoogle } from "react-icons/fa";
import { authClient } from "../../../lib/auth-client";
import { AuthShell, Field, Divider } from "../../../Components/AuthUI";
import { track } from "../../../lib/track";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const { error } = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: "/blueprint",
    });
    if (error) {
      setError(error.message ?? "Something went wrong");
      setStatus("idle");
    } else {
      track("CompleteRegistration");
      setStatus("sent");
    }
  }

  async function google() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/blueprint" });
  }

  if (status === "sent") {
    return (
      <AuthShell title="Check your email">
        <p className="text-[var(--bp-text-dim)]">
          We sent a verification link to <strong className="text-white">{email}</strong>.
          Click it to activate your account and start watching.
        </p>
        <Link href="/sign-in" className="mt-6 inline-block text-[var(--bp-accent)] hover:underline">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account">
      <button
        onClick={google}
        className="w-full flex items-center justify-center gap-2 rounded-md border border-[var(--bp-border-strong)] py-2.5 hover:bg-white/5 transition-colors"
      >
        <FaGoogle /> Continue with Google
      </button>
      <Divider />
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Name" value={name} onChange={setName} type="text" required />
        <Field label="Email" value={email} onChange={setEmail} type="email" required />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          type="password"
          required
          minLength={8}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-md bg-white text-black font-medium py-2.5 hover:bg-zinc-200 transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-5 text-sm text-[var(--bp-text-dim)]">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-[var(--bp-accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
