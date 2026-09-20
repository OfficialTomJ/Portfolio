import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeBybitApiKeyInfo } from "./bybit-identity";

test("allowlists account identity without retaining credential metadata", () => {
  const sanitized = sanitizeBybitApiKeyInfo({
    userID: 123,
    readOnly: 1,
    deadlineDay: 90,
    expiredAt: "2027-01-01T00:00:00.000Z",
    apiKey: "private-key-material",
    secret: "private-secret-material",
    ips: ["192.0.2.1"],
    note: "private account label",
    permissions: { ContractTrade: ["Order", "Position"] },
  });

  assert.deepEqual(sanitized, {
    userID: 123,
    readOnly: 1,
    deadlineDay: 90,
    expiredAt: "2027-01-01T00:00:00.000Z",
  });
  assert.equal("apiKey" in sanitized, false);
  assert.equal("secret" in sanitized, false);
  assert.equal("ips" in sanitized, false);
  assert.equal("permissions" in sanitized, false);
});
