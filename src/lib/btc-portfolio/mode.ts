import "server-only";
import { portfolioReviewPolicy } from "./mode-policy";

/** Database-backed portfolio review is available only locally and on staging. */
export function portfolioDatabaseEnabled() {
  return portfolioReviewPolicy(process.env).database;
}
