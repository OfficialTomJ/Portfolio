"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProfileView } from "@/lib/community/model";

type Data = Partial<ProfileView> & { error?: string };
export default function DiscordConnection({ initialData }: { initialData?: ProfileView }) {
  const [data, setData] = useState<Data | null>(initialData ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialData) return;
    let active = true;
    fetch("/api/discord/profile", { cache: "no-store" }).then((response) => response.json())
      .then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setData({ error: "Connection status is temporarily unavailable." }); });
    return () => { active = false; };
  }, [initialData]);
  async function action(action: "disconnect" | "retry") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/discord/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update the connection.");
      setData(result);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { setBusy(false); }
  }
  const contact = data?.contact;
  const connected = contact?.state === "active";
  return <section className="mx-auto max-w-2xl px-4 sm:px-6 pb-10">
    <div className="rounded-xl border border-[var(--bp-border)] p-6 space-y-4" aria-live="polite">
      <h2 className="text-lg font-semibold">Discord community</h2>
      <p className="text-sm text-[var(--bp-text-dim)]">{!data ? "Loading connection…" : data.error ||
        (contact?.state === "unlinked" ? "Discord is unlinked."
          : contact?.state === "blocked" ? "Community access is restricted. Contact support."
          : contact?.discordName ? `${contact.discordName} · ${contact.state === "revoking" ? "unlinking" : contact.role === "done" ? "verified" : "activation pending"}` : "No Discord connected.")}</p>
      {contact?.trustedMember && <p className="text-sm">Your Discord was verified as an existing community member. Unlinking your website account keeps that Discord’s community access.</p>}
      {connected && !contact.trustedMember && <p className="text-sm">Unlinking removes the Verified role from this Discord. You can verify a connection again later.</p>}
      {contact?.message && <p className="text-sm">{contact.message}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {busy && <p role="status" className="text-sm">Updating connection…</p>}
      <div className="flex flex-wrap items-center gap-5 text-sm">
        {connected && <button disabled={busy} onClick={() => action("disconnect")} className="rounded-lg border border-red-400 px-4 py-2 text-red-300 disabled:opacity-50">Unlink Discord</button>}
        {contact?.state === "revoking" || connected && contact.role !== "done" ? <button disabled={busy} onClick={() => action("retry")} className="underline disabled:opacity-50">Check connection / retry</button> : null}
        {!data?.error && data && (!contact || contact.state === "unlinked") && <Link href="/discord/verify" className="text-[var(--bp-accent)] underline">Link Discord</Link>}
      </div>
    </div>
  </section>;
}
