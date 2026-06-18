// Shared "not financial advice" disclosure config — imported by both the client
// modal and the server API, so the wording, validity window and "is this
// acceptance still valid" rule live in exactly one place.
//
// NOTE: the copy below is a reasonable starting draft, NOT legal sign-off. Have
// it reviewed for CBA compliance before relying on it, and bump
// DISCLOSURE_VERSION whenever the wording changes so prior acknowledgments are
// re-prompted.

/** Bump when the disclosure wording changes to force everyone to re-acknowledge. */
export const DISCLOSURE_VERSION = 1;

/** Acceptance is re-prompted once it is older than this many days. */
export const DISCLOSURE_VALIDITY_DAYS = 365;

export const DISCLOSURE_TITLE = "Important — please read before continuing";

export interface DisclosureSection {
  /** Optional short heading shown above the body for readability. */
  heading?: string;
  body: string;
}

export const DISCLOSURE_SECTIONS: DisclosureSection[] = [
  {
    heading: "Educational purposes only",
    body: "Everything in The Blueprint is provided for general education and information. Nothing here is financial, investment, trading, tax or legal advice, nor a recommendation, offer or solicitation to buy, sell or hold any asset.",
  },
  {
    heading: "Personal views only",
    body: "All opinions expressed are my own personal views. They do not represent, and are not endorsed, authorised or sponsored by, my employer or any organisation I am affiliated with.",
  },
  {
    heading: "Not a licensed adviser",
    body: "I am not a licensed financial adviser, and this content does not take into account your personal objectives, financial situation or needs. You should obtain independent, licensed professional advice before making any financial decision.",
  },
  {
    heading: "High risk",
    body: "Cryptocurrency and trading are highly volatile and high risk. You can lose some or all of your capital. Past performance is not indicative of future results.",
  },
  {
    heading: "No warranty, no liability",
    body: "While I aim for accuracy, I make no warranty as to the completeness or accuracy of any information provided. You act on it entirely at your own risk, and I accept no liability for any loss or damage arising from its use.",
  },
  {
    body: "By ticking the box below and continuing, you confirm that you have read, understood and agree to this disclosure.",
  },
];

type Acceptance = { version: number; acceptedAt: string | Date };

/**
 * True only if the acceptance matches the current disclosure version AND was
 * recorded within the validity window. Used by both client and server so the
 * re-prompt rule is identical on both sides.
 */
export function isAcceptanceValid(a: Acceptance | null | undefined): boolean {
  if (!a || a.version !== DISCLOSURE_VERSION) return false;
  const acceptedAt = new Date(a.acceptedAt).getTime();
  if (Number.isNaN(acceptedAt)) return false;
  const ageMs = Date.now() - acceptedAt;
  return ageMs >= 0 && ageMs <= DISCLOSURE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
}
