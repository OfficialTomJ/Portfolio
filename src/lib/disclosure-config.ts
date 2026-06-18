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

/** ISO date the disclosure copy was last revised — shown on the compliance page. */
export const DISCLOSURE_UPDATED = "2026-06-18";

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

/**
 * Expanded disclosure shown on the standalone /compliance page. This is the
 * fuller, permanent reference version — the popup (DISCLOSURE_SECTIONS) stays
 * short and scannable. Final wording is a draft pending CBA compliance review.
 */
export const COMPLIANCE_PAGE_SECTIONS: DisclosureSection[] = [
  {
    heading: "Educational and informational purposes only",
    body: "All content in The Blueprint — including videos, written material, charts, examples and any accompanying resources — is provided solely for general education and information. Nothing on this site constitutes financial, investment, trading, tax, accounting or legal advice, nor does it constitute a recommendation, endorsement, offer or solicitation to buy, sell or hold any cryptocurrency, security or other financial product.",
  },
  {
    heading: "General information, not personal advice",
    body: "Any information provided is general in nature and does not take into account your personal objectives, financial situation or particular needs. Before acting on any information, you should consider its appropriateness having regard to your own circumstances and obtain independent, licensed financial, tax and legal advice.",
  },
  {
    heading: "Personal views — not my employer's",
    body: "All opinions expressed are my own personal views, held in a personal capacity. They do not represent, and are not endorsed, authorised or sponsored by, my employer or any organisation I am affiliated with, and nothing here is published in the course of, or on behalf of, that employment.",
  },
  {
    heading: "Not licensed; no client relationship",
    body: "I am not a licensed financial adviser and do not hold an Australian Financial Services Licence (AFSL). Accessing or using this content does not create any advisory, fiduciary, brokerage or client relationship between you and me.",
  },
  {
    heading: "Risk warning",
    body: "Cryptocurrency and trading are highly volatile and carry a high level of risk. You can lose some or all of your capital, and you should never trade or invest money you cannot afford to lose. You are solely responsible for your own decisions.",
  },
  {
    heading: "No performance guarantees",
    body: "Past performance, and any hypothetical or simulated performance, is not a reliable indicator of future results. Any examples, figures or outcomes shown are illustrative only and are not a guarantee of, or projection for, any particular result.",
  },
  {
    heading: "Conflicts of interest",
    body: "I may hold, buy or sell positions in assets discussed in this content at any time. Unless expressly stated, the content is not sponsored by, or produced at the direction of, any third party, and I receive no compensation for featuring any specific asset.",
  },
  {
    heading: "Third-party content and links",
    body: "This site may reference or link to third-party tools, platforms, websites and content for convenience. I do not control, endorse or accept responsibility for any third-party content, and your use of it is at your own risk and subject to that third party's terms.",
  },
  {
    heading: "No warranty; limitation of liability",
    body: "All information is provided “as is” and “as available”, without any warranty of accuracy, completeness, timeliness or fitness for a particular purpose. To the maximum extent permitted by law, I accept no liability for any loss or damage of any kind arising from your use of, or reliance on, this content.",
  },
  {
    heading: "Jurisdiction",
    body: "This content is general in nature and may not be appropriate or lawful in every jurisdiction. You are responsible for ensuring that your access to and use of this content, and any decisions you make, comply with the laws that apply to you.",
  },
  {
    heading: "Changes to this disclosure",
    body: "This disclosure may be updated from time to time. The “Last updated” date shown above reflects the version currently in effect; please review it periodically.",
  },
  {
    heading: "Contact",
    body: "If you have any questions about this disclosure, you can get in touch at hi@thomas-johnston.com.",
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
