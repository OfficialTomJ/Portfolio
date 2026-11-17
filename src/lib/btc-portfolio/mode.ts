import "server-only";
import { portfolioPublicPolicy, portfolioReviewPolicy } from "./mode-policy";

/** Database-backed portfolio review is available only locally and on staging. */
export function portfolioDatabaseEnabled() {
  return portfolioReviewPolicy(process.env).database;
}

export function portfolioPublicEnabled() {
  return portfolioPublicPolicy(process.env);
}
