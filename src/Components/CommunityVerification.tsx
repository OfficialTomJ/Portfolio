"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ENROLLMENT_NOTICE, type ContactView, type ProfileView } from "@/lib/community/model";
import DiscordConnection from "./DiscordConnection";

type Status = {
  stage: "new" | "oauth" | "email" | "sending" | "sent" | "verified";
  purpose?: "connect" | "manage";
  discordName?: string | null;
  email?: string | null;
  contact?: ContactView | null;
  test?: boolean;
  inviteUrl?: string;
};
const button = "rounded-lg bg-[var(--bp-accent)] px-5 py-3 font-medium text-black disabled:opacity-50 disabled:cursor-wait";
const input = "mt-2 w-full rounded-lg border border-[var(--bp-border)] bg-black px-4 py-3 text-white focus:outline-2 focus:outline-[var(--bp-accent)]";

export default function CommunityVerification({ purpose }: { purpose: "connect" | "manage" }) {
  const [status, setStatus] = useState<Status>({ stage: "new" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [available, setAvailable] = useState(true);
  const [resendAt, setResendAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [account, setAccount] = useState<ProfileView | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (purpose === "manage") {
        const response = await fetch("/api/discord/profile", { cache: "no-store" });
        if (response.ok) { const profile = await response.json(); if (active) setAccount(profile); return; }
      }
      const response = await fetch("/api/discord/verification", { cache: "no-store" });
      const data = await response.json();
      if (!active) return;
      if (response.ok) {
        setStatus(data.purpose && data.purpose !== purpose ? { stage: "new", test: data.test, inviteUrl: data.inviteUrl } : data);
        if (data.purpose === purpose && data.email) setEmail(data.email);
      } else {
        setError(data.error ?? "Verification is unavailable.");
        setAvailable(response.status !== 503);
      }
      if (new URLSearchParams(window.location.search).get("authorization") === "failed") {
        setError("Discord authorization failed. Join the community server and connect Discord again.");
      }
    }
    load().catch(() => { if (active) setError("Could not load verification. Refresh to try again."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [purpose]);

  useEffect(() => {
    if (!resendAt) return;
    const tick = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick(); const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  async function action(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/discord/verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not complete verification.");
      if (data.redirect) { window.location.assign(data.redirect); return; }
      if (body.action === "send") {
        setStatus((current) => ({ ...current, stage: "sent", email: data.email }));
        setResendAt(Date.now() + data.resendIn * 1000); setCode("");
      } else if (data.stage) setStatus((current) => ({ ...current, ...data }));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { setBusy(false); }
  }

  const verified = status.stage === "verified";
  const roleReady = status.contact?.state === "active" && status.contact.role === "done";
  const canEmail = status.stage === "email" || status.stage === "sending" || status.stage === "sent";
  if (account) return <main className="mx-auto max-w-2xl px-5 py-12">
    <h1 className="mb-4 text-3xl font-semibold">Manage your Discord connection</h1>
    <p className="mb-8 text-[var(--bp-text-dim)]">You’re signed in. You can unlink your Discord here without an email code.</p>
    <DiscordConnection initialData={account} />
  </main>;
  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <p className="mb-3 text-sm text-[var(--bp-accent)]">Discord community {status.test ? "· test pilot" : ""}</p>
      <h1 className="text-3xl font-semibold">{purpose === "manage" ? "Manage your Discord connection" : "Verify to join the conversation"}</h1>
      <p className="mt-4 text-[var(--bp-text-dim)]">{purpose === "manage"
        ? "Without a signed-in Mentor account, verify the email you used to link Discord. Existing members verified by the community keep access when they unlink."
        : "Join the server, connect your Discord, then verify your email. No Mentor account or password is needed."}</p>
      {error && <p role="alert" className="mt-6 rounded-lg border border-red-400/40 p-4 text-red-300">{error}</p>}
      {busy && <p role="status" className="mt-4 text-sm text-[var(--bp-text-dim)]">Working…</p>}
      {(status.stage === "new" || status.stage === "oauth") && <div className="mt-8 space-y-4">
        {purpose === "connect" && status.inviteUrl && <p><a href={status.inviteUrl} target="_blank" rel="noreferrer" className="underline">Join {status.test ? "the test server" : "the community"} first</a></p>}
        <button className={button} disabled={busy || !available} onClick={() => action({ action: "start", purpose })}>
          {purpose === "connect" ? "Connect Discord" : "Verify my email"}
        </button>
      </div>}
      {canEmail && <div className="mt-8 space-y-6">
        {status.discordName && <p>Connected as <strong>{status.discordName}</strong></p>}
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); action({ action: "send", email, accepted: purpose === "connect" }); }}>
          <label className="block" htmlFor="community-email">Email address
            <input id="community-email" type="email" autoComplete="email" required maxLength={254} className={input} value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
          </label>
          {purpose === "connect" && <p className="text-sm text-[var(--bp-text-dim)]">{ENROLLMENT_NOTICE} <Link href="/privacy" className="underline">Privacy policy</Link></p>}
          <button className={button} disabled={busy || seconds > 0 || status.stage === "sending"} type="submit">
            {seconds > 0 ? `Resend in ${seconds}s` : status.stage === "sent" ? "Send a new code" : "Send verification code"}
          </button>
        </form>
        {status.stage === "sent" && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); action({ action: "confirm", code }); }}>
          <p className="text-sm">Code sent to {status.email}. It expires in five minutes; you have three attempts.</p>
          <label className="block" htmlFor="community-code">Six-digit email code
            <input id="community-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className={input} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} disabled={busy} />
          </label>
          <button className={button} disabled={busy} type="submit">Verify code</button>
        </form>}
      </div>}
      {verified && <div className="mt-8 space-y-5" aria-live="polite">
        <h2 className="text-xl font-semibold">{purpose === "manage" ? "Email verified" : roleReady ? "You’re verified" : "Email verified—access is updating"}</h2>
        {status.contact ? <>
          <p>{status.contact.state === "unlinked" ? status.contact.trustedMember ? "Discord is unlinked. Your existing-member community access is unchanged." : "Discord is unlinked. The old account no longer has the Verified role."
            : status.contact.state === "revoking" ? "Unlinking the old Discord. Wait for this to complete before connecting a replacement."
            : status.contact.state === "blocked" ? "Community access is restricted. Contact support."
            : roleReady ? `Community access is active for ${status.contact.discordName}.` : "Your verification is saved. Community access has not been activated yet."}</p>
          {status.contact.message && <p className="text-sm">{status.contact.message}</p>}
          {purpose === "connect" && <p className="text-sm text-[var(--bp-text-dim)]">No Mentor account was created. {status.contact.mailing === "done" ? "Your community email-list enrollment is saved." : "Your email-list enrollment is saved for processing."}</p>}
          {purpose === "manage" && status.contact.trustedMember && <p className="text-sm">You’re verified as an existing member. Unlinking keeps that Discord’s community access.</p>}
          {purpose === "manage" && status.contact.state === "active" && <button className="rounded-lg border border-red-400 px-5 py-3 text-red-300 disabled:opacity-50" disabled={busy} onClick={() => action({ action: "disconnect" })}>Unlink Discord</button>}
          {(status.contact.role !== "done" || status.contact.mailing !== "done") && <button className={button} disabled={busy} onClick={() => action({ action: "retry" })}>Check activation / retry</button>}
          {roleReady && status.inviteUrl && <p><a href={status.inviteUrl} className={button}>Return to Discord</a></p>}
          {status.contact.state === "unlinked" && <p><Link href="/discord/verify" className="underline">Connect a new Discord account</Link></p>}
        </> : <p>No community connection was found for this email.</p>}
      </div>}
      {status.stage !== "new" && <button className="mt-8 text-sm underline disabled:opacity-50" disabled={busy || !available} onClick={() => action({ action: "start", purpose })}>Start again{purpose === "connect" ? " / change Discord" : ""}</button>}
      <p className="mt-8 text-sm text-[var(--bp-text-dim)]"><Link href={purpose === "connect" ? "/discord/manage" : "/discord/verify"} className="underline">{purpose === "connect" ? "Manage an existing connection" : "Verify a Discord account"}</Link></p>
    </main>
  );
}
