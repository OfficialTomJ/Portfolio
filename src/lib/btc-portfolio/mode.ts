import "server-only";
import { portfolioReviewPolicy } from "./mode-policy";

export function portfolioDatabaseEnabled() {
  return portfolioReviewPolicy(process.env).database;
}

/** Never enabled by a URL, or on production deployments. No live integration exists in mock v1. */
export function btcMockEnabled() {
  return portfolioReviewPolicy(process.env).enabled;
}
