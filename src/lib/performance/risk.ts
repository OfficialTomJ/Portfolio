export interface PerformanceRiskVersion {
  id: string;
  sourceAccountId: string;
  environment: string;
  version: number;
  riskAmount: number;
  currency: "USDT";
  effectiveFrom: Date;
}

export interface LockedPerformanceRisk {
  riskVersionId: string;
  riskAmount: number;
  riskCurrency: "USDT";
}

export function selectRiskVersion(
  versions: PerformanceRiskVersion[],
  openedAt: Date
): PerformanceRiskVersion | null {
  return [...versions]
    .filter(
      (item) =>
        Number.isFinite(item.riskAmount) &&
        item.riskAmount > 0 &&
        item.effectiveFrom.getTime() <= openedAt.getTime()
    )
    .sort(
      (a, b) =>
        b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
        b.version - a.version
    )[0] ?? null;
}

export function lockPerformanceRisk(
  existing: Partial<LockedPerformanceRisk> | null | undefined,
  versions: PerformanceRiskVersion[],
  openedAt: Date
): LockedPerformanceRisk | null {
  if (
    existing?.riskVersionId &&
    Number.isFinite(existing.riskAmount) &&
    Number(existing.riskAmount) > 0 &&
    existing.riskCurrency === "USDT"
  ) {
    return {
      riskVersionId: existing.riskVersionId,
      riskAmount: Number(existing.riskAmount),
      riskCurrency: "USDT",
    };
  }

  const selected = selectRiskVersion(versions, openedAt);
  return selected
    ? {
        riskVersionId: selected.id,
        riskAmount: selected.riskAmount,
        riskCurrency: selected.currency,
      }
    : null;
}
