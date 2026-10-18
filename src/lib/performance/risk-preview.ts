import { RISK_REDUCTION_NOTICE, publicRiskEvents } from "./risk-events";
import type { PerformanceDataset } from "./types";

export function riskPreviewEnabled(): boolean {
  return process.env.VERCEL_ENV === "preview" && process.env.MONGODB_DB === "blueprint_dev" && process.env.PERFORMANCE_RISK_PREVIEW === "1";
}

/** Synthetic data only; never loads or persists account data. */
export function riskPreviewDataset(scenario?: string): PerformanceDataset {
  const asOf = "2026-10-18T02:00:00Z";
  const times = ["2026-10-10T12:00:00Z", "2026-10-12T12:00:00Z", "2026-10-15T12:00:00Z", "2026-10-17T12:00:00Z", "2026-10-18T00:00:00Z"];
  const amounts = [-1, 0.5, -2, 1, -0.25];
  const dataset: PerformanceDataset = {
    id: "risk-staging-synthetic", label: "Synthetic staging demonstration", description: "Synthetic trades, not trading results",
    inceptionAt: "2026-10-01T00:00:00Z", asOf,
    trades: times.slice(0, scenario === "gap" ? 3 : 5).map((closedAt, i) => ({ id: `trade-staging-risk-${i}`, symbol: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BTCUSDT", "HYPEUSDT"][i], direction: "Long", openedAt: new Date(Date.parse(closedAt) - 3600000).toISOString(), closedAt, resultR: amounts[i], entryPrice: 100, exitPrice: 100 + amounts[i], tradeType: i % 2 ? "DAY" : "SWING" })),
    riskEvents: publicRiskEvents([{ effectiveFrom: new Date(scenario === "future" ? "2026-10-20T00:00:00Z" : "2026-10-17T00:00:00Z"), publicNotice: { id: "risk-event-0123456789abcdef0123", ...RISK_REDUCTION_NOTICE } }], new Date(asOf)),
  };
  return dataset;
}
