"use client";

import type { AllocationMode } from "@/lib/tjss/types";

// Strategy selection, NOT strategy configuration.
//
// This panel used to expose 22 numeric parameters (fear caps, greed floors,
// EMA lengths, boost multipliers) with hint copy explaining the backtested
// reasoning behind each default. All of that was compiled into the public
// bundle and echoed in every request URL.
//
// A member now picks a named strategy and an allocation mode. The parameters
// behind those names live in Mongo and are applied server-side.

export interface PresetOption {
  id: string;
  label: string;
  description: string;
}

export interface ModeBehaviour {
  when: string;
  does: string;
}

export interface ModeOption {
  id: AllocationMode;
  label: string;
  hint: string;
  behaviour?: ModeBehaviour[];
  tradeoff?: string;
}

/** What the member controls. No strategy parameters. */
export interface ViewConfig {
  presetId: string;
  mode: AllocationMode;
}

interface Props {
  config: ViewConfig;
  presets: PresetOption[];
  modes: ModeOption[];
  onChange: (next: ViewConfig) => void;
}


/**
 * Strategy selection. A SECTION of the simulation card, not its own card, no
 * surface or padding of its own.
 *
 * Deliberately quiet by default. The first cut showed the method description,
 * the mode summary, three behaviour entries and a trade-off paragraph all at
 * once, roughly fifteen lines of prose before you reached the thing you came
 * to press. Almost none of it is needed to *choose*; it is needed to
 * *understand*, and only when asked.
 *
 * So the resting state is a name, three buttons and one sentence. Everything
 * else moves behind a disclosure, matching the pattern EvidenceNote already
 * uses further down the same card.
 */
export default function ConfigControls({ config, presets, modes, onChange }: Props) {
  const preset = presets.find((p) => p.id === config.presetId) ?? presets[0];
  const mode = modes.find((m) => m.id === config.mode) ?? modes[0];
  const hasDetail = !!(preset?.description || mode?.behaviour?.length || mode?.tradeoff);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
        {/* Method, a control only when there is a choice; otherwise a label. */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] uppercase tracking-wider text-[var(--bp-text-dim)]">
            Method
          </p>
          {presets.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onChange({ ...config, presetId: p.id })}
                  aria-pressed={config.presetId === p.id}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    config.presetId === p.id
                      ? "bg-[var(--bp-accent)] text-black"
                      : "bg-black/30 text-[var(--bp-text-dim)] hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-[var(--bp-text)]">{preset?.label}</p>
          )}
        </div>

        {/* Allocation mode */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[11px] uppercase tracking-wider text-[var(--bp-text-dim)]">
            Allocation mode
          </p>
          <div className="inline-grid grid-cols-3 gap-1.5 rounded-lg bg-black/30 p-1">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => onChange({ ...config, mode: m.id })}
                aria-pressed={config.mode === m.id}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  config.mode === m.id
                    ? "bg-[var(--bp-accent)] text-black"
                    : "text-[var(--bp-text-dim)] hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The one sentence that earns its place at rest: what the chosen mode does. */}
      {mode && (
        <p className="text-xs leading-relaxed text-[var(--bp-text)]">{mode.hint}</p>
      )}

      {hasDetail && (
        <details className="group rounded-lg border border-[var(--bp-border)] bg-black/20">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--bp-text-dim)] hover:text-[var(--bp-text)]">
            <span aria-hidden="true" className="transition group-open:rotate-90">▸</span>
            How {mode?.label ?? "this mode"} works
          </summary>

          <div className="flex flex-col gap-4 px-3 pb-3 pt-1">
            {preset?.description && (
              <p className="text-xs leading-relaxed text-[var(--bp-text-dim)]">
                {preset.description}
              </p>
            )}

            {/* Side by side so they read as a comparison, not three paragraphs. */}
            {!!mode?.behaviour?.length && (
              <dl className="grid gap-3 sm:grid-cols-3">
                {mode.behaviour.map((b) => (
                  <div key={b.when} className="flex flex-col gap-0.5">
                    <dt className="text-[10px] uppercase tracking-wider text-[var(--bp-text-dim)]">
                      {b.when}
                    </dt>
                    <dd className="text-xs leading-snug text-[var(--bp-text)]">{b.does}</dd>
                  </div>
                ))}
              </dl>
            )}

            {mode?.tradeoff && (
              <p className="text-xs leading-relaxed text-[var(--bp-text-dim)]">
                <span className="font-semibold text-[var(--bp-text)]">Trade-off. </span>
                {mode.tradeoff}
              </p>
            )}

            <p className="border-t border-[var(--bp-border)] pt-3 text-[11px] leading-relaxed text-[var(--bp-text-dim)]">
              Rule states are computed server-side from the method as taught.
              Selecting a mode changes which variant of the ruleset is reported and
              re-runs the chart above; the rules themselves are fixed, and nothing
              here is tailored to you.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
