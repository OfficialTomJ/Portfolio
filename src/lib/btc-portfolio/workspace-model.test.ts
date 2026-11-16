import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newEvent } from "./engine";
import { calculatePortfolioDraft, prepareWorkspaceChange, portfolioDraftSchema, WorkspaceConflict, type PortfolioWorkspace } from "./workspace-model";

function workspace(): PortfolioWorkspace {
  const start = "2019-01-01T00:00:00.000Z", end = "2019-01-03T00:00:00.000Z";
  return { _id: "synthetic-test", revision: 0, publicReleaseId: randomUUID(), validatedFingerprint: null, operations: [], updatedAt: end,
    draft: portfolioDraftSchema.parse({
      ledger: { mode: "reconstructed", currency: "USD", inceptionAt: start, asOf: end, campaigns: [],
        events: [{ ...newEvent(start), id: "TEST-OPENING", kind: "opening", asset: "USD", quantity: "100", price: "1", feeAsset: "USD", privateNote: "PRIVATE_TEST_INPUT", publicReason: "Synthetic test opening." }],
        marks: [start, "2019-01-02T00:00:00.000Z", end].map(at => ({ asset: "BTC", at, price: "20" })),
      },
      history: { version: 1, status: "approved-localhost", historical: [{ at: "2018-01-01T00:00:00.000Z", portfolioIndex: 100, btcIndex: 100 }, { at: "2018-12-31T00:00:00.000Z", portfolioIndex: 110, btcIndex: 105 }], bridge: [], currentInceptionAt: start, currentBtcIndexAtInception: 105 },
      propResults: [{ id: "PRIVATE_TEST_RESULT", openedAt: "2019-01-01T01:00:00.000Z", closedAt: "2019-01-02T01:00:00.000Z", resultR: 1 }], riskFraction: 0.01,
      notes: [{ note: { id: "note-0123456789abcdef", asset: "BTC", period: "2019", title: "Synthetic thesis", reason: "Testing editorial visibility.", articleUrl: "" }, visible: true }], privateNotes: "PRIVATE_TEST_RESEARCH",
    }),
  };
}
test("a private draft produces only the percentage projection and preserves methodology warnings", () => {
  const w = workspace(), before = structuredClone(w), result = calculatePortfolioDraft(w.draft);
  assert.ok(result.preview.history); assert.equal(result.preview.editorialNotes!.length, 1);
  assert.deepEqual(result.preview.activity, []); assert.deepEqual(result.preview.campaigns, []);
  assert.ok(result.preview.points.every(point => Object.keys(point.weights).length === 0));
  assert.ok(!JSON.stringify(result.preview).includes("PRIVATE_TEST"));
  assert.equal(result.checks.find(check => check.name === "Independent actual statements")!.passed, false);
  assert.deepEqual(w, before);
});
test("private saves invalidate validation, stale edits fail and retries cannot change payload", () => {
  const w = workspace(), draft = structuredClone(w.draft); draft.privateNotes = "Corrected synthetic note";
  const command = { action: "save-draft" as const, revision: 0, requestId: randomUUID(), draft, reason: "Synthetic correction" };
  const result = prepareWorkspaceChange(w, command)!;
  assert.equal(result.next.revision, 1); assert.equal(result.next.validatedFingerprint, null);
  assert.equal(w.revision, 0); assert.equal(prepareWorkspaceChange(result.next, command), null);
  assert.throws(() => prepareWorkspaceChange(result.next, { ...command, reason: "Different" }), WorkspaceConflict);
  assert.throws(() => prepareWorkspaceChange(result.next, { ...command, requestId: randomUUID() }), WorkspaceConflict);
});
test("publication requires the current validated revision and hidden notes stay out of previews", () => {
  const w = workspace(), fingerprint = calculatePortfolioDraft(w.draft).fingerprint;
  assert.throws(() => prepareWorkspaceChange(w, { action: "publish", revision: 0, requestId: randomUUID(), fingerprint }), /Validate/);
  const validated = prepareWorkspaceChange(w, { action: "validate", revision: 0, requestId: randomUUID(), fingerprint })!.next;
  assert.ok(prepareWorkspaceChange(validated, { action: "publish", revision: 1, requestId: randomUUID(), fingerprint }));
  const hidden = prepareWorkspaceChange(validated, { action: "save-note", revision: 1, requestId: randomUUID(), note: w.draft.notes[0].note, visible: false, reason: "Hide synthetic note" })!;
  assert.equal(hidden.calculated.preview.editorialNotes!.length, 0);
  assert.equal(hidden.next.validatedFingerprint, null);
  assert.throws(() => calculatePortfolioDraft({ ...w.draft, notes: [...w.draft.notes, w.draft.notes[0]] }), /unique/);
});
test("invalid chronology, balances and private financial copy cannot be saved", () => {
  const w = workspace();
  assert.throws(() => calculatePortfolioDraft({ ...w.draft, propResults: [{ ...w.draft.propResults[0], closedAt: "2018-01-01T00:00:00.000Z" }] }));
  assert.throws(() => calculatePortfolioDraft({ ...w.draft, notes: [{ ...w.draft.notes[0], note: { ...w.draft.notes[0].note, reason: "Account balance $12345" } }] }));
  const bad = structuredClone(w.draft); bad.ledger.events.push({ ...newEvent("2019-01-02T00:00:00.000Z"), id: "TEST-OVERSPEND", asset: "BTC", quantity: "100", price: "20", feeAsset: "USD", publicReason: "Synthetic invalid purchase." });
  assert.throws(() => calculatePortfolioDraft(bad));
});
