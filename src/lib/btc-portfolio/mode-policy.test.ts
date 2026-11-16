import test from "node:test";
import assert from "node:assert/strict";
import { portfolioReviewPolicy } from "./mode-policy";
test("database review requires explicit opt-in and cannot activate in production", () => {
  assert.deepEqual(portfolioReviewPolicy({ NODE_ENV: "production", VERCEL_ENV: "production", BTC_PORTFOLIO_MODE: "database" }), { database: false, enabled: false });
  assert.deepEqual(portfolioReviewPolicy({ NODE_ENV: "development", VERCEL_ENV: "production", BTC_PORTFOLIO_MODE: "database" }), { database: false, enabled: false });
  assert.deepEqual(portfolioReviewPolicy({ NODE_ENV: "production", BTC_PORTFOLIO_MODE: "database" }), { database: false, enabled: false });
  assert.deepEqual(portfolioReviewPolicy({ NODE_ENV: "production", VERCEL_ENV: "preview", BTC_PORTFOLIO_MODE: "database" }), { database: true, enabled: true });
  assert.equal(portfolioReviewPolicy({ NODE_ENV: "production", VERCEL_ENV: "preview" }).enabled, false);
  assert.equal(portfolioReviewPolicy({ NODE_ENV: "production", VERCEL_ENV: "preview", BTC_PORTFOLIO_MODE: "mock" }).enabled, false);
  assert.equal(portfolioReviewPolicy({ NODE_ENV: "development", BTC_PORTFOLIO_MODE: "database" }).database, true);
  assert.equal(portfolioReviewPolicy({ NODE_ENV: "development", BTC_PORTFOLIO_MODE: "off" }).enabled, false);
});
