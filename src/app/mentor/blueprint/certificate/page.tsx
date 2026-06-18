import Link from "next/link";
import { PiArrowLeftThin } from "react-icons/pi";
import { getSession } from "../../../../lib/session";
import {
  getCompletionStatus,
  getOrIssueCertificate,
} from "../../../../lib/certificate";
import AccessGate from "../../../../Components/AccessGate";
import Certificate from "../../../../Components/Certificate";

// GATED. Issues/displays the Season 1 completion certificate.
export default async function CertificatePage() {
  const session = await getSession();
  if (!session?.user?.emailVerified) return <AccessGate />;

  const status = await getCompletionStatus(session.user.id);

  // Not finished yet — show a locked state, not the sign-up gate.
  if (!status.isComplete) {
    const remaining = status.total - status.completed;
    return (
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center">
        <p className="text-[var(--bp-accent)] uppercase tracking-widest text-sm mb-3">
          Certificate locked
        </p>
        <h1 className="text-3xl font-semibold">Keep going — you&apos;re almost there</h1>
        <p className="mt-4 text-[var(--bp-text-dim)]">
          {status.total === 0
            ? "The course isn't available yet. Check back soon."
            : `Finish all ${status.total} episodes to unlock your certificate. ${remaining} to go.`}
        </p>
        {status.total > 0 && (
          <div className="mt-6 mx-auto max-w-md h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[var(--bp-accent)]"
              style={{ width: `${status.percent}%` }}
            />
          </div>
        )}
        <Link
          href="/blueprint"
          className="mt-8 inline-flex items-center gap-1 text-[var(--bp-text-dim)] hover:text-white transition-colors"
        >
          <PiArrowLeftThin className="text-3xl" /> Back to season
        </Link>
      </main>
    );
  }

  const name = session.user.name?.trim() || session.user.email;
  const cert = await getOrIssueCertificate(session.user.id, name);

  return (
    <main>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-8">
        <Link
          href="/blueprint"
          className="inline-flex items-center gap-1 text-[var(--bp-text-dim)] hover:text-white transition-colors"
        >
          <PiArrowLeftThin className="text-3xl" /> Back to season
        </Link>
      </div>
      <Certificate
        certificateId={cert.certificateId}
        name={cert.name}
        issuedAt={cert.issuedAt}
        season={cert.season}
      />
    </main>
  );
}
