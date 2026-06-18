"use client";

import { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { FaPrint, FaLink, FaCheck } from "react-icons/fa";

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function Certificate({
  certificateId,
  name,
  issuedAt,
  season,
}: {
  certificateId: string;
  name: string;
  issuedAt: Date;
  season: number;
}) {
  const [confetti, setConfetti] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setShareUrl(`${window.location.origin}/verify/${certificateId}`);
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setConfetti(true);
    });
    const t = setTimeout(() => setConfetti(false), 6000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [certificateId]);

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      {confetti && (
        <Confetti
          width={size.width}
          height={size.height}
          numberOfPieces={220}
          recycle={false}
          colors={["#ff6719", "#ffffff", "#ffb088"]}
        />
      )}

      {/* The certificate card */}
      <div
        id="bp-certificate"
        className="bp-surface rounded-2xl border border-[var(--bp-border-strong)] px-6 py-12 sm:px-12 sm:py-16 text-center bp-hero-glow"
      >
        <p className="text-2xl font-semibold tracking-tight">
          The Blueprint<span className="text-[var(--bp-accent)]">.</span>
        </p>
        <p className="mt-8 text-sm uppercase tracking-widest text-[var(--bp-text-dim)]">
          Certificate of Completion
        </p>
        <p className="mt-4 text-sm text-[var(--bp-text-dim)]">
          This certifies that
        </p>
        <p className="mt-2 text-3xl sm:text-4xl font-semibold">{name}</p>
        <p className="mt-4 max-w-md mx-auto text-[var(--bp-text-dim)]">
          has successfully completed{" "}
          <span className="text-[var(--bp-text)]">Season {season}</span> of The
          Blueprint trading course.
        </p>
        <p className="mt-8 text-sm text-[var(--bp-text-dim)]">
          Issued {fmtDate(issuedAt)}
        </p>
        <p className="mt-6 text-xs text-[var(--bp-text-dim)] break-all">
          Verify at {shareUrl || `…/verify/${certificateId}`}
        </p>
        <p className="text-[10px] text-[var(--bp-text-dim)]/70 mt-1">
          ID {certificateId}
        </p>
      </div>

      {/* Actions (hidden when printing) */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 bp-cert-actions">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--bp-accent)] text-black font-semibold px-5 py-2.5 hover:brightness-110 transition-all"
        >
          <FaPrint className="text-sm" /> Print / Download
        </button>
        <button
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--bp-border-strong)] px-5 py-2.5 hover:bg-white/5 transition-colors"
        >
          {copied ? (
            <>
              <FaCheck className="text-xs text-[var(--bp-accent)]" /> Copied
            </>
          ) : (
            <>
              <FaLink className="text-xs" /> Copy share link
            </>
          )}
        </button>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #bp-certificate, #bp-certificate * { visibility: visible; }
          #bp-certificate {
            position: absolute; inset: 0; margin: auto;
            border: none; box-shadow: none;
          }
          .bp-cert-actions { display: none !important; }
        }
      `}</style>
    </div>
  );
}
