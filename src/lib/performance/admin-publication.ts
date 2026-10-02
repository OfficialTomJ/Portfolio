import type { PerformanceTrade } from "./types";

/** Authenticated editor state only; never included in public datasets. */
export type AdminPublication =
  | { status: "active" }
  | { status: "published"; trade: PerformanceTrade }
  | { status: "unpublished"; trade: PerformanceTrade; fingerprint: string };

export interface PublicationOutcome {
  kind: "published" | "changed" | "failed" | "unconfirmed";
  message: string;
  recheck: boolean;
}

/** An HTTP success alone is not proof that a result was published. */
export function publicationOutcome(status: number, body: { published?: unknown; approvalRecorded?: unknown }): PublicationOutcome {
  if (status >= 200 && status < 300 && body.published === true) return { kind: "published", message: "Trade published. Refreshing results.", recheck: false };
  if (body.approvalRecorded === true) return { kind: "unconfirmed", message: "Approval was recorded, but publication is not confirmed. Refresh and check the trade before trying again.", recheck: true };
  if (status === 409) return { kind: "changed", message: "This result changed or did not pass publication checks. Refresh and review the current trade before publishing.", recheck: true };
  // Authorization/input errors precede approval. Server/network failures may not.
  if ([400, 401, 403, 404].includes(status)) return { kind: "failed", message: "Publication was rejected. No publication was confirmed. Refresh and check your access and the trade.", recheck: true };
  return { kind: "unconfirmed", message: "Publication could not be confirmed. Refresh and check whether this trade is published before trying again.", recheck: true };
}
