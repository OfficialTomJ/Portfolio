import Link from "next/link";
import { FaCheckCircle } from "react-icons/fa";
import { getCertificateById } from "../../../../lib/certificate";

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// PUBLIC verification page for a shared certificate link. No auth.
export default async function VerifyCertificate({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cert = await getCertificateById(id);

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
      <div className="relative flex flex-col items-center justify-center text-center min-h-[calc(100vh-4rem)] px-4">
        {cert ? (
          <>
            <FaCheckCircle className="text-4xl text-[var(--bp-accent)] mb-5" />
            <p className="text-[var(--bp-accent)] uppercase tracking-widest text-sm mb-3">
              Verified certificate
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold max-w-xl leading-tight">
              {cert.name}
            </h1>
            <p className="text-[var(--bp-text-dim)] mt-4 max-w-md">
              completed{" "}
              <span className="text-[var(--bp-text)]">
                The Blueprint — Season {cert.season}
              </span>{" "}
              on {fmtDate(cert.issuedAt)}.
            </p>
          </>
        ) : (
          <>
            <p className="text-[var(--bp-text-dim)] uppercase tracking-widest text-sm mb-3">
              Not found
            </p>
            <h1 className="text-3xl font-semibold max-w-xl leading-tight">
              This certificate could not be verified
            </h1>
            <p className="text-[var(--bp-text-dim)] mt-4 max-w-md">
              The link may be incorrect or the certificate no longer exists.
            </p>
          </>
        )}
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-[var(--bp-text-dim)] hover:text-white transition-colors"
        >
          The Blueprint<span className="text-[var(--bp-accent)]">.</span>
        </Link>
      </div>
    </main>
  );
}
