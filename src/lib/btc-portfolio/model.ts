import { createHash } from "node:crypto";
import { makeMockLedger } from "./fixture";
import { PortfolioInputError, replayPortfolio } from "./engine";
import { eventSchema, publicSchema, type AdminSnapshot, type Command, type Ledger, type Workspace } from "./schema";

export const fingerprint = (draft: Ledger) => createHash("sha256").update(JSON.stringify(draft)).digest("hex");
export class PortfolioConflictError extends Error {}
export function initialWorkspace(): Workspace {
  const draft = makeMockLedger(), published = replayPortfolio(draft).publicData;
  return { _id: "btc-mock-v1", revision: 0, draft, published, releases: [{ release: 1, at: draft.asOf, revision: 0, data: published }], audit: [], operations: [], replay: null };
}
export function adminSnapshot(w: Workspace): AdminSnapshot {
  const replay = replayPortfolio(w.draft);
  return { revision: w.revision, fingerprint: fingerprint(w.draft), draft: w.draft, preview: replay.publicData, published: publicSchema.parse(w.published), summary: replay.summary,
    releases: w.releases.map(({ release, at, revision }) => ({ release, at, revision })).reverse(), audit: [...w.audit].reverse(), replay: w.replay, checks: replay.checks };
}
export function applyCommand(current: Workspace, command: Command, actor: string, at = new Date().toISOString()): Workspace {
  if (current.operations.includes(command.requestId)) return current;
  if (current.revision !== command.revision) throw new PortfolioConflictError("This workspace changed. Refresh status; your open form will be retained.");
  const w = structuredClone(current);
  const previous = command.action === "save-event" ? w.draft.events.find(e => e.id === command.event.id) : command.action === "void" ? w.draft.events.find(e => e.id === command.id) : undefined;
  const before = previous ? structuredClone(previous) : undefined;
  let action: string = command.action;
  if (command.action === "save-event") {
    if (before && !command.event.correctionReason.trim()) throw new PortfolioInputError("Add a correction reason when changing an existing record.");
    const index = w.draft.events.findIndex(e => e.id === command.event.id);
    if (index < 0) w.draft.events.push(command.event); else w.draft.events[index] = command.event;
    action = before ? "Corrected transaction" : "Recorded transaction";
  }
  if (command.action === "void") {
    if (!before) throw new PortfolioInputError("Transaction not found.");
    const event = w.draft.events.find(e => e.id === command.id)!;
    if (event.voided) throw new PortfolioInputError("This record is already voided.");
    event.voided = true; event.correctionReason = command.reason; action = "Voided transaction";
  }
  if (command.action === "import") {
    let added = 0, duplicates = 0;
    for (const event of command.events) {
      const existing = w.draft.events.find(e => e.id === event.id || (event.sourceId && e.sourceId === event.sourceId));
      if (existing) {
        // Immutable source evidence is preserved in audit; effective corrections always win on re-import.
        const original = [...w.audit].find(a => a.before?.id === existing.id)?.before ?? existing;
        const economic = (e: typeof event) => JSON.stringify([e.at, e.kind, e.account, e.asset, e.quantity, e.price, e.fee, e.feeAsset, e.positionId, e.direction, e.leverage]);
        if (economic(original) !== economic(event) && economic(existing) !== economic(event)) throw new PortfolioInputError("An imported source record conflicts with saved evidence. Review it instead of overwriting a correction.");
        duplicates++; continue;
      }
      w.draft.events.push(event); added++;
    }
    action = `Imported ${added} transactions; skipped ${duplicates} duplicates`;
  }
  if (command.action === "save-campaign") {
    // Reuse the same public-content policy as transaction reasons.
    const example = w.draft.events[0];
    if (example) eventSchema.parse({ ...example, publicReason: command.campaign.reason });
    const index = w.draft.campaigns.findIndex(c => c.id === command.campaign.id);
    if (index < 0) w.draft.campaigns.push(command.campaign); else w.draft.campaigns[index] = command.campaign;
    action = "Updated DCA plan";
  }
  const replay = replayPortfolio(w.draft);
  if (command.action === "replay") { w.replay = { fingerprint: fingerprint(w.draft), at, checks: replay.checks }; action = "Validated mock YTD replay"; }
  if (command.action === "publish") {
    if (command.fingerprint !== fingerprint(w.draft)) throw new PortfolioConflictError("The reviewed draft changed. Review it again.");
    if (w.replay?.fingerprint !== fingerprint(w.draft)) throw new PortfolioInputError("Run the mock replay for this draft before publishing.");
    const release = Math.max(...w.releases.map(r => r.release)) + 1;
    w.published = publicSchema.parse({ ...replay.publicData, release, publishedAt: at });
    w.releases.push({ release, revision: w.revision + 1, at, data: w.published }); action = `Published mock release ${release}`;
  }
  if (command.action === "restore") {
    const release = w.releases.find(r => r.release === command.release);
    if (!release) throw new PortfolioInputError("Release not found.");
    w.published = publicSchema.parse(release.data); action = `Restored public release ${release.release}; draft retained`;
  }
  w.revision++;
  const after = before ? w.draft.events.find(e => e.id === before.id) : command.action === "save-event" ? command.event : undefined;
  w.audit.push({ at, actor, action, revision: w.revision, ...(before ? { before: structuredClone(before) } : {}), ...(after ? { after: structuredClone(after) } : {}) });
  w.operations.push(command.requestId);
  return w;
}
