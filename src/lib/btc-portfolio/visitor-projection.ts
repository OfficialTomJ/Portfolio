import { publicSchema, type PublicPortfolio } from "./schema";

/** Apply on every public read, even when an older release contains execution fields. */
export function visitorPortfolio(input: unknown): PublicPortfolio {
  const data = publicSchema.parse(input);
  const allocation = new Map<string, PublicPortfolio["allocation"][number]>();
  for (const row of data.allocation) {
    if (!/^[A-Za-z0-9]{1,20}$/.test(row.asset)) throw new Error("Invalid public asset.");
    const key = `${row.asset}:${row.type}:${row.direction}`, previous = allocation.get(key);
    // A single reporting bucket exposes total allocation, never the custody split.
    allocation.set(key, { account: "margin", asset: row.asset, type: row.type, direction: row.direction, weight: (previous?.weight ?? 0) + row.weight });
  }
  return publicSchema.parse({
    ...data,
    lastActivityAt: data.asOf,
    allocation: [...allocation.values()],
    points: data.points.map(({ at, portfolioIndex, btcIndex }) => ({ at, portfolioIndex, btcIndex, weights: {} })),
    activity: [], campaigns: [], stories: undefined, performanceCoverage: undefined,
  });
}
