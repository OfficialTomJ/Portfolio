export function portfolioReviewPolicy(env: { NODE_ENV?: string; VERCEL_ENV?: string; BTC_PORTFOLIO_MODE?: string }) {
  const local = env.NODE_ENV === "development" && env.VERCEL_ENV !== "production";
  const preview = env.VERCEL_ENV === "preview";
  const database = env.BTC_PORTFOLIO_MODE === "database" && (local || preview);
  return { database, enabled: database };
}

/** Public production access never grants editor access. */
export function portfolioPublicPolicy(env: { NODE_ENV?: string; VERCEL_ENV?: string; BTC_PORTFOLIO_MODE?: string; PORTFOLIO_PUBLIC_MODE?: string }) {
  return portfolioReviewPolicy(env).database || env.VERCEL_ENV === "production" && env.PORTFOLIO_PUBLIC_MODE === "published";
}
export function portfolioPublicDatabaseName(env: { VERCEL_ENV?: string; MONGODB_DB?: string; PORTFOLIO_MONGODB_DB?: string }) {
  const expected = env.VERCEL_ENV === "production" ? "blueprint_prod" : "blueprint_dev";
  const selected = env.VERCEL_ENV === "production" ? env.PORTFOLIO_MONGODB_DB : env.MONGODB_DB;
  if (selected !== expected) throw new Error("Portfolio database configuration does not match this environment.");
  return expected;
}
