import {
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED,
} from "../../../lib/disclosure-config";

export const metadata = {
  title: "Privacy, The Blueprint",
  description:
    "What The Blueprint collects, why, where it is stored and how to have it removed.",
};

export default function PrivacyPage() {
  const updated = new Date(PRIVACY_UPDATED).toLocaleDateString("en-AU", {
    dateStyle: "long",
  });

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--bp-text)]">
        Privacy
      </h1>
      <p className="mt-2 text-sm text-[var(--bp-text-dim)]">Last updated: {updated}</p>
      <div className="bp-prose mt-8">
        {PRIVACY_SECTIONS.map((s, i) => (
          <section key={i}>
            {s.heading && <h2>{s.heading}</h2>}
            <p>{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
