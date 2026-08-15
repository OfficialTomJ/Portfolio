import { z } from "zod";

// What a member is allowed to send.
//
// This file used to accept ~30 strategy parameters as request overrides, which
// meant the field names, their bounds and their current values were all public:
// in the repo, in the client bundle, and in every request URL.
//
// A member now sends only their OWN inputs, which preset, which allocation
// mode, how much capital, what date range, what to draw. Every strategy
// parameter is resolved server-side from `tjss_presets` in Mongo and is not
// overridable from a request at all.

export const allocationModeSchema = z.enum(["roundTrip", "coreTactical", "accumulate"]);
export const timeframeSchema = z.enum(["D", "W", "M"]);

/** GET /api/tjss/market. EMA overlays are always returned, so they aren't
 *  requested, toggling one is a client-side visibility change. */
export const marketQuerySchema = z.object({
  preset: z.string().min(1).max(64).optional(),
  mode: allocationModeSchema.optional(),
  tf: timeframeSchema.default("D"),
});

/** POST /api/tjss/backtest */
export const backtestRequestSchema = z.object({
  preset: z.string().min(1).max(64).optional(),
  mode: allocationModeSchema.optional(),
  initialCapital: z.number().min(1).max(1_000_000_000).optional(),
  contributionAmount: z.number().min(0).max(1_000_000_000).optional(),
  contributionCadenceDays: z.number().int().min(1).max(365).optional(),
  fromDate: z.string().max(32).optional(),
  toDate: z.string().max(32).optional(),
});

export type MarketQuery = z.infer<typeof marketQuerySchema>;
export type BacktestRequest = z.infer<typeof backtestRequestSchema>;

/** ISO date → UTC-day unix seconds, or null when absent/unparseable. */
export function toUnixDay(dateStr?: string): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / 1000 / 86400) * 86400;
}
