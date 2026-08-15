"use client";

// What the backtest above does and does not establish.
//
// A backtest curve is persuasive in a way the underlying evidence often does
// not justify, so the limits travel with the number rather than living in a
// document nobody opens.
//
// The findings are now fetched from Mongo (`tjss_evidence`) rather than inlined
// here, the figures came from research that stays off the public repo, and
// this component is public. It renders whatever it is given and knows nothing.

export interface Finding {
  label: string;
  headline: string;
  detail: string;
  tone: "warn" | "good" | "plain";
}

export interface EvidenceData {
  findings: Finding[];
  footnote: string;
}

const TONE: Record<Finding["tone"], string> = {
  warn: "#f59e0b",
  good: "#22c55e",
  plain: "var(--bp-text-dim)",
};

export default function EvidenceNote({ evidence }: { evidence: EvidenceData | null }) {
  if (!evidence?.findings?.length) return null;

  return (
    <details className="rounded-lg border border-[var(--bp-border)] bg-black/20">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold flex items-center gap-2">
        <span aria-hidden="true" className="text-[var(--bp-text-dim)]">▸</span>
        What this backtest does and doesn&apos;t show
        <span className="ml-auto text-[11px] font-normal text-[var(--bp-text-dim)]">
          read before acting on it
        </span>
      </summary>

      <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
        {evidence.findings.map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <p
              className="text-[11px] uppercase tracking-wider"
              style={{ color: TONE[f.tone] ?? TONE.plain }}
            >
              {f.label}
            </p>
            <p className="text-sm font-semibold">{f.headline}</p>
            <p className="text-xs leading-relaxed text-[var(--bp-text-dim)]">{f.detail}</p>
          </div>
        ))}

        <p className="text-[11px] leading-relaxed text-[var(--bp-text-dim)] border-t border-[var(--bp-border)] pt-3">
          {evidence.footnote}
        </p>
      </div>
    </details>
  );
}
