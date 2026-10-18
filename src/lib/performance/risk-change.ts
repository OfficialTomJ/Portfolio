import type { PerformanceRiskVersion } from "./risk";

export interface RiskChangeInput {
  riskAmount: number;
  effectiveFrom: Date;
  reason: string;
  expectedAccountId?: string;
  expectedCurrentAmount?: number;
  publicNotice?: boolean;
}

export function assertRiskChange(input: RiskChangeInput, facts: {
  accountId: string; currentAmount?: number; latestOpenedAt?: Date;
  openPositionCount: number; now: Date;
}) {
  if (!Number.isFinite(input.riskAmount) || input.riskAmount <= 0) throw new Error("Risk amount must be greater than zero");
  if (!Number.isFinite(input.effectiveFrom.getTime())) throw new Error("Risk effective date is invalid");
  if (input.expectedAccountId && input.expectedAccountId !== facts.accountId) throw new Error("Connected account does not match the expected account");
  if (input.expectedCurrentAmount !== undefined && input.expectedCurrentAmount !== facts.currentAmount) throw new Error("Current risk amount changed; review a new preview");
  if (facts.openPositionCount) throw new Error("Risk changes require a flat account");
  if (facts.latestOpenedAt && input.effectiveFrom <= facts.latestOpenedAt) throw new Error("Effective time must be after all existing position entries");
  if (input.effectiveFrom < facts.now) throw new Error("Backdated risk changes are not allowed");
  if (input.publicNotice && !(facts.currentAmount && input.riskAmount < facts.currentAmount)) throw new Error("The public risk-reduction notice requires a reduction from an existing risk amount");
}

export function currentRiskAmount(versions: PerformanceRiskVersion[], now: Date): number | undefined {
  return [...versions].filter(v => v.effectiveFrom <= now).sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0]?.riskAmount;
}
