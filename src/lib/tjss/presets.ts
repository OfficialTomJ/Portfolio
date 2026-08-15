import "server-only";
import { cache } from "react";
import { getDb } from "../mongodb";
import type { TjssConfig, BacktestConfig, AllocationMode } from "./types";

// The tuned strategy lives in Mongo, never in this repo and never in a client
// bundle. `tjss_presets` is written by scripts/seed-tjss.ts from the gitignored
// research/ directory; nothing here ever reaches the browser.
//
// Two shapes matter:
//   TjssPreset        full config, server-side only, never serialised to a response
//   PresetSummary     id/label/description, the only part a member ever sees

export type BacktestDefaults = Omit<BacktestConfig, keyof TjssConfig>;

export interface TjssPreset {
  id: string;
  label: string;
  description: string;
  order: number;
  config: TjssConfig;
  backtest: BacktestDefaults;
}

export interface PresetSummary {
  id: string;
  label: string;
  description: string;
}

export interface ModeBehaviour {
  /** The situation being described, e.g. "At a sentiment top". */
  when: string;
  /** What the model does in it. */
  does: string;
}

export interface ModeOption {
  id: AllocationMode;
  label: string;
  hint: string;
  behaviour: ModeBehaviour[];
  /** The cost of this mode's behaviour, stated plainly. */
  tradeoff: string;
  order: number;
}

export interface EvidenceFinding {
  label: string;
  headline: string;
  detail: string;
  tone: "warn" | "good" | "plain";
}

export interface Evidence {
  findings: EvidenceFinding[];
  footnote: string;
}

/** Thrown when Mongo has no strategy. Callers turn this into a 503 rather than
 * falling back to a default, so a bad deploy fails visibly instead of quietly
 * serving a strategy nobody chose. */
export class MissingStrategyError extends Error {
  constructor(what: string) {
    super(`TJSS ${what} not found, run \`npm run tjss:seed\``);
    this.name = "MissingStrategyError";
  }
}

const NO_ID = { projection: { _id: 0 } } as const;

/** Every preset, full config included. Server-side only, do not serialise. */
export const getPresets = cache(async (): Promise<TjssPreset[]> => {
  const presets = await getDb()
    .collection<TjssPreset>("tjss_presets")
    .find({}, NO_ID)
    .sort({ order: 1 })
    .toArray();
  if (!presets.length) throw new MissingStrategyError("presets");
  return presets;
});

/** One preset by id. Falls back to the lowest-ordered preset for an unknown id
 * so a stale client can't 500 the dashboard. */
export async function getPreset(id?: string | null): Promise<TjssPreset> {
  const presets = await getPresets();
  return presets.find((p) => p.id === id) ?? presets[0];
}

/** The safe projection, what /api/tjss/presets is allowed to return. */
export async function getPresetSummaries(): Promise<PresetSummary[]> {
  const presets = await getPresets();
  return presets.map(({ id, label, description }) => ({ id, label, description }));
}

export const getModes = cache(async (): Promise<ModeOption[]> => {
  const modes = await getDb()
    .collection<ModeOption>("tjss_modes")
    .find({}, NO_ID)
    .sort({ order: 1 })
    .toArray();
  if (!modes.length) throw new MissingStrategyError("allocation modes");
  return modes;
});

export const getEvidence = cache(async (): Promise<Evidence> => {
  const doc = await getDb()
    .collection<Evidence & { key: string }>("tjss_evidence")
    .findOne({ key: "backtest" }, NO_ID);
  if (!doc) throw new MissingStrategyError("evidence");
  return { findings: doc.findings, footnote: doc.footnote };
});

/**
 * Merge a preset with the member's own inputs to build a runnable backtest
 * config. The member controls capital, contributions and allocation mode; every
 * strategy parameter comes from the preset and is never accepted from a request.
 */
export function toBacktestConfig(
  preset: TjssPreset,
  member: {
    mode?: AllocationMode;
    initialCapital?: number;
    contributionAmount?: number;
    contributionCadenceDays?: number;
  }
): BacktestConfig {
  return {
    ...preset.config,
    ...preset.backtest,
    ...(member.mode ? { allocationMode: member.mode } : {}),
    ...(member.initialCapital != null ? { initialCapital: member.initialCapital } : {}),
    ...(member.contributionAmount != null
      ? { contributionAmount: member.contributionAmount }
      : {}),
    ...(member.contributionCadenceDays != null
      ? { contributionCadenceDays: member.contributionCadenceDays }
      : {}),
  };
}

/** Live-signal config: preset parameters with only the mode overridable. */
export function toSignalConfig(
  preset: TjssPreset,
  mode?: AllocationMode
): TjssConfig {
  return mode ? { ...preset.config, allocationMode: mode } : preset.config;
}
