import assert from "node:assert/strict";
import test from "node:test";
import {
  lockPerformanceRisk,
  selectRiskVersion,
  type PerformanceRiskVersion,
} from "./risk";

const account = "bybit-account";
const environment = "demo";

function version(
  id: string,
  revision: number,
  riskAmount: number,
  effectiveFrom: string
): PerformanceRiskVersion {
  return {
    id,
    sourceAccountId: account,
    environment,
    version: revision,
    riskAmount,
    currency: "USDT",
    effectiveFrom: new Date(effectiveFrom),
  };
}

const versions = [
  version("risk-v1", 1, 250, "2025-01-01T00:00:00.000Z"),
  version("risk-v2", 2, 375, "2025-02-01T00:00:00.000Z"),
];

test("selects the risk version active when a trade opened", () => {
  assert.equal(
    selectRiskVersion(versions, new Date("2025-01-12T00:00:00.000Z"))?.id,
    "risk-v1"
  );
  assert.equal(
    selectRiskVersion(versions, new Date("2025-02-02T00:00:00.000Z"))?.id,
    "risk-v2"
  );
});

test("does not rewrite a cycle that already locked an earlier version", () => {
  assert.deepEqual(
    lockPerformanceRisk(
      { riskVersionId: "risk-v1", riskAmount: 250, riskCurrency: "USDT" },
      versions,
      new Date("2025-02-02T00:00:00.000Z")
    ),
    { riskVersionId: "risk-v1", riskAmount: 250, riskCurrency: "USDT" }
  );
});

test("returns null when no version predates the trade", () => {
  assert.equal(
    lockPerformanceRisk(null, versions, new Date("2024-12-31T23:59:59.000Z")),
    null
  );
});
