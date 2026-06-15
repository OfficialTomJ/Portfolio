"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";
import { Field } from "./AuthUI";

function Note({ kind, children }: { kind: "ok" | "err"; children: React.ReactNode }) {
  return (
    <p className={`text-sm mt-1 ${kind === "ok" ? "text-[var(--bp-accent)]" : "text-red-400"}`}>
      {children}
    </p>
  );
}

export default function AccountForm({
  initialName,
  email,
  image,
  emailVerified,
}: {
  initialName: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [nameMsg, setNameMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  const [pwMsg, setPwMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    const { error } = await authClient.updateUser({ name });
    setSavingName(false);
    if (error) setNameMsg({ k: "err", t: error.message ?? "Could not save" });
    else {
      setNameMsg({ k: "ok", t: "Saved" });
      router.refresh();
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);
    setEmailMsg(null);
    const { error } = await authClient.changeEmail({
      newEmail,
      callbackURL: "/account",
    });
    setSavingEmail(false);
    if (error) setEmailMsg({ k: "err", t: error.message ?? "Could not change email" });
    else
      setEmailMsg({
        k: "ok",
        t: `Approval link sent to your current email (${email}). Confirm it to finish.`,
      });
  }

  async function sendReset() {
    setSendingReset(true);
    setPwMsg(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setSendingReset(false);
    if (error) setPwMsg({ k: "err", t: error.message ?? "Could not send reset email" });
    else setPwMsg({ k: "ok", t: `Password reset link sent to ${email}.` });
  }

  const initial = (initialName || email || "?").charAt(0).toUpperCase();

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        {image ? (
          <Image
            src={image}
            alt=""
            width={56}
            height={56}
            style={{ width: 56, height: 56 }}
            className="rounded-full object-cover shrink-0"
          />
        ) : (
          <span className="grid place-items-center w-14 h-14 rounded-full bg-[var(--bp-accent)] text-black text-xl font-semibold">
            {initial}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold">{initialName || "Your account"}</h1>
          <p className="text-sm text-[var(--bp-text-dim)] flex items-center gap-2">
            {email}
            {emailVerified ? (
              <span className="text-[var(--bp-accent)] text-xs">· verified</span>
            ) : (
              <span className="text-yellow-500 text-xs">· unverified</span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Name */}
        <section className="bp-surface rounded-xl p-6">
          <h2 className="font-semibold mb-4">Profile</h2>
          <form onSubmit={saveName} className="space-y-3">
            <Field label="Name" value={name} onChange={setName} type="text" required />
            {nameMsg && <Note kind={nameMsg.k}>{nameMsg.t}</Note>}
            <button
              type="submit"
              disabled={savingName}
              className="rounded-md bg-white text-black font-medium px-5 py-2 hover:bg-zinc-200 transition-colors disabled:opacity-60"
            >
              {savingName ? "Saving…" : "Save"}
            </button>
          </form>
        </section>

        {/* Email */}
        <section className="bp-surface rounded-xl p-6">
          <h2 className="font-semibold mb-1">Email</h2>
          <p className="text-sm text-[var(--bp-text-dim)] mb-4">
            Current: {email}. Changing it sends an approval link to your current
            email.
          </p>
          <form onSubmit={changeEmail} className="space-y-3">
            <Field
              label="New email"
              value={newEmail}
              onChange={setNewEmail}
              type="email"
              required
            />
            {emailMsg && <Note kind={emailMsg.k}>{emailMsg.t}</Note>}
            <button
              type="submit"
              disabled={savingEmail}
              className="rounded-md bg-white text-black font-medium px-5 py-2 hover:bg-zinc-200 transition-colors disabled:opacity-60"
            >
              {savingEmail ? "Sending…" : "Change email"}
            </button>
          </form>
        </section>

        {/* Password */}
        <section className="bp-surface rounded-xl p-6">
          <h2 className="font-semibold mb-1">Password</h2>
          <p className="text-sm text-[var(--bp-text-dim)] mb-4">
            We&apos;ll email you a secure link to set a new password. (Works even
            if you signed up with Google and never set one.)
          </p>
          {pwMsg && <Note kind={pwMsg.k}>{pwMsg.t}</Note>}
          <button
            onClick={sendReset}
            disabled={sendingReset}
            className="mt-2 rounded-md border border-[var(--bp-border-strong)] px-5 py-2 hover:bg-white/5 transition-colors disabled:opacity-60"
          >
            {sendingReset ? "Sending…" : "Send password reset link"}
          </button>
        </section>

        {/* Sign out */}
        <button
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
          className="text-sm text-[var(--bp-text-dim)] hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
