import assert from "node:assert/strict";
import test from "node:test";
import { publicationOutcome } from "./admin-publication";

test("publication needs explicit server confirmation, not just HTTP success", () => {
  assert.equal(publicationOutcome(200, { published: true }).kind, "published");
  for (const body of [{}, { published: false }, { published: "true" }]) assert.equal(publicationOutcome(200, body).kind, "unconfirmed");
  assert.equal(publicationOutcome(500, { published: true }).kind, "unconfirmed");
});
test("recorded approvals and server failures are never described as safely pending", () => {
  for (const status of [409, 502]) {
    const outcome = publicationOutcome(status, { approvalRecorded: true });
    assert.equal(outcome.kind, "unconfirmed");
    assert.ok(outcome.recheck);
    assert.match(outcome.message, /Approval was recorded/);
  }
  assert.equal(publicationOutcome(502, {}).kind, "unconfirmed");
});
test("stale candidates and rejected requests require another review", () => {
  assert.equal(publicationOutcome(409, {}).kind, "changed");
  for (const status of [400, 401, 403, 404]) assert.equal(publicationOutcome(status, {}).kind, "failed");
  assert.ok(publicationOutcome(409, {}).recheck);
});
