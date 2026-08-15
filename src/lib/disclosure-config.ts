// Shared "not financial advice" disclosure config, imported by both the client
// modal and the server API, so the wording, validity window and "is this
// acceptance still valid" rule live in exactly one place.
//
// NOTE: the copy below is a reasonable starting draft, NOT legal sign-off. Have
// it reviewed for CBA compliance before relying on it, and bump
// DISCLOSURE_VERSION whenever the wording changes so prior acknowledgments are
// re-prompted.

/**
 * Bump when the disclosure wording changes to force everyone to re-acknowledge.
 *
 * v2 (2026-08-15): added the research-tools / simulated-performance section for
 * the TJSS dashboard. Every prior acceptance predates that content, so it is
 * re-prompted rather than carried over.
 */
export const DISCLOSURE_VERSION = 2;

/** ISO date the disclosure copy was last revised, shown on the compliance page. */
export const DISCLOSURE_UPDATED = "2026-08-15";

/** Acceptance is re-prompted once it is older than this many days. */
export const DISCLOSURE_VALIDITY_DAYS = 365;

export const DISCLOSURE_TITLE = "Important: please read before continuing";

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
 * fuller, permanent reference version, the popup (DISCLOSURE_SECTIONS) stays
 * short and scannable. Final wording is a draft pending CBA compliance review.
 */
export const COMPLIANCE_PAGE_SECTIONS: DisclosureSection[] = [
  {
    heading: "Educational and informational purposes only",
    body: "All content in The Blueprint, including videos, written material, charts, examples and any accompanying resources, is provided solely for general education and information. Nothing on this site constitutes financial, investment, trading, tax, accounting or legal advice, nor does it constitute a recommendation, endorsement, offer or solicitation to buy, sell or hold any cryptocurrency, security or other financial product.",
  },
  {
    heading: "General information, not personal advice",
    body: "Any information provided is general in nature and does not take into account your personal objectives, financial situation or particular needs. Before acting on any information, you should consider its appropriateness having regard to your own circumstances and obtain independent, licensed financial, tax and legal advice.",
  },
  {
    heading: "Personal views, not my employer's",
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
    heading: "Research tools, simulated results and rule states",
    body: "The members' dashboard publishes research: it applies a documented, fixed set of rules to public Bitcoin price data and the Crypto Fear & Greed Index, and reports what those rules did. The \"rule state\" and \"model exposure\" figures describe the behaviour of that model. They are not recommendations, signals or instructions, they are not tailored to you, and they should not be read as suggesting that you buy, sell or hold anything. Backtest and simulation results are hypothetical: they are produced with the benefit of hindsight, on a ruleset developed by reference to the same historical data, and no member achieved them. Simulated results routinely overstate what is achievable in practice. Where the underlying research contradicts the headline figures, including out-of-sample underperformance against a simple dollar-cost-averaging comparison, that is stated alongside the results, and you should read it before drawing any conclusion.",
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

/**
 * Privacy policy for the /privacy page. Reflects what the app actually stores,
 * keep it in step with the Mongo collections (`user`, `account`, `session`,
 * `progress`, `disclosures`, `certificates`, `events`) rather than writing to a
 * template. Also a draft pending review.
 */
export const PRIVACY_UPDATED = "2026-08-15";

export const PRIVACY_SECTIONS: DisclosureSection[] = [
  {
    heading: "Who this covers",
    body: "This policy covers thomas-johnston.com and mentor.thomas-johnston.com, operated by Thomas Johnston as an individual. If you have any question about your information, contact hi@thomas-johnston.com.",
  },
  {
    heading: "What is collected",
    body: "If you create an account: your name, email address, whether that email has been verified, and your profile image if you sign in with Google. If you sign in with Google, an access token is stored so the session works. Once signed in: which episodes you have watched and your progress through them, your acknowledgement of the compliance disclosure and when you gave it, any certificate issued to you, and a record of resource downloads. Sessions record an IP address and browser user-agent. Nothing you enter into the dashboard's simulation inputs, capital, contributions, dates, is stored; those are used to compute a result and discarded.",
  },
  {
    heading: "Why it is collected",
    body: "To sign you in and keep you signed in, to track and resume your course progress, to issue and verify certificates, to keep a record that the compliance disclosure was acknowledged, and to understand in aggregate which content is used.",
  },
  {
    heading: "Analytics",
    body: "The mentor site uses Google Analytics and the Meta Pixel, which set cookies and share usage data with those providers under their own privacy policies. These record how pages are used; they are not used to make decisions about you individually.",
  },
  {
    heading: "Where it is stored, and who can see it",
    body: "Data is held in MongoDB Atlas and the site is hosted on Vercel; both may process data outside Australia. Access is limited to the site operator. Information is not sold, and is not shared with third parties except the service providers named in this policy or where required by law.",
  },
  {
    heading: "What is public",
    body: "A certificate verification link is deliberately public: anyone holding the link can see the name on the certificate, the season completed and the date of completion. Nothing else about your account is publicly accessible. If you would rather your certificate link not exist, ask and it will be removed.",
  },
  {
    heading: "How long it is kept",
    body: "Account and progress data is kept while your account exists. Disclosure acknowledgements are kept as a compliance record. You can ask for your account and associated data to be deleted at any time.",
  },
  {
    heading: "Your rights",
    body: "You can request access to the personal information held about you, ask for it to be corrected, or ask for it to be deleted, by emailing hi@thomas-johnston.com. If you are unhappy with how a request is handled, you can complain to the Office of the Australian Information Commissioner (oaic.gov.au).",
  },
  {
    heading: "Changes to this policy",
    body: "This policy may be updated from time to time. The “Last updated” date above reflects the version currently in effect.",
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
