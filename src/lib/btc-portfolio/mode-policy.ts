export function portfolioReviewPolicy(env: { NODE_ENV?: string; VERCEL_ENV?: string; BTC_PORTFOLIO_MODE?: string }) {
  const local = env.NODE_ENV === "development" && env.VERCEL_ENV !== "production";
  const preview = env.VERCEL_ENV === "preview";
  const database = env.BTC_PORTFOLIO_MODE === "database" && (local || preview);
  return { database, enabled: database };
}
