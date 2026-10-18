import type { EquityPoint, PublicRiskEvent } from "./types";

export const RISK_REDUCTION_NOTICE = {
  title: "Risk reduced",
  description: "Position risk was reduced from this date. Historical results retain their original risk units. Cumulative R measures normalised outcomes, not dollar or percentage account returns.",
} as const;

export interface RiskPublicNotice { id: string; title: string; description: string }

export function validRiskNotice(value: unknown): value is RiskPublicNotice {
  if (!value || typeof value !== "object") return false;
  const n = value as Record<string, unknown>;
  return typeof n.id === "string" && /^risk-event-[a-f0-9]{20}$/.test(n.id) &&
    typeof n.title === "string" && n.title.length > 0 && n.title.length <= 80 &&
    typeof n.description === "string" && n.description.length > 0 && n.description.length <= 600;
}

/** Explicit allowlist: never spread a private risk document into a client DTO. */
export function publicRiskEvents(documents: Array<{ effectiveFrom?: unknown; publicNotice?: unknown }>, asOf: Date): PublicRiskEvent[] {
  return documents.flatMap(d => {
    if (!(d.effectiveFrom instanceof Date) || !Number.isFinite(d.effectiveFrom.getTime()) ||
      d.effectiveFrom > asOf || !validRiskNotice(d.publicNotice)) return [];
    return [{ id: d.publicNotice.id, effectiveAt: d.effectiveFrom.toISOString(),
      title: d.publicNotice.title, description: d.publicNotice.description }];
  }).sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.id.localeCompare(b.id));
}

/** Presentation anchors only. These must never enter trade counts or statistics. */
export function riskEventTimeline(points: EquityPoint[], events: PublicRiskEvent[] = []): EquityPoint[] {
  if (!points.length) return [];
  const original = [...points].sort((a, b) => a.time - b.time);
  const times = new Set(original.map(p => p.time));
  for (const e of events) {
    const time = Math.floor(Date.parse(e.effectiveAt) / 1000);
    if (Number.isFinite(time)) times.add(time);
  }
  let index = 0;
  return [...times].sort((a, b) => a - b).map(time => {
    while (index + 1 < original.length && original[index + 1].time <= time) index++;
    return { time, value: time < original[0].time ? 0 : original[index].value };
  });
}

/** The static image and interactive chart both use equally spaced timeline items. */
export function riskEventIndex(points: EquityPoint[], event: PublicRiskEvent): number {
  return points.findIndex(p => p.time === Math.floor(Date.parse(event.effectiveAt) / 1000));
}
