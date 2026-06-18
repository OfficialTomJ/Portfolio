import {
  COMPLIANCE_PAGE_SECTIONS,
  DISCLOSURE_TITLE,
  DISCLOSURE_UPDATED,
} from "../../../lib/disclosure-config";

export const metadata = {
  title: "Compliance & Disclosure — The Blueprint",
  description:
    "Important disclosure for The Blueprint: educational content only, not financial advice.",
};

export default function CompliancePage() {
  const updated = new Date(DISCLOSURE_UPDATED).toLocaleDateString("en-AU", {
    dateStyle: "long",
  });

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--bp-text)]">
        {DISCLOSURE_TITLE}
      </h1>
      <p className="mt-2 text-sm text-[var(--bp-text-dim)]">Last updated: {updated}</p>
      <div className="bp-prose mt-8">
        {COMPLIANCE_PAGE_SECTIONS.map((s, i) => (
          <section key={i}>
            {s.heading && <h2>{s.heading}</h2>}
            <p>{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
