import type {
  PerformanceDataset,
  PerformanceTrade,
  TradeCandle,
  TradeDirection,
} from "./types";

type SeedTrade = {
  id: string;
  symbol: string;
  direction: TradeDirection;
  openedAt: string;
  durationHours: number;
  resultR: number;
  entryPrice: number;
  riskPct: number;
  mfeR: number;
  maeR: number;
};

function trade(seed: SeedTrade): PerformanceTrade {
  const riskDistance = seed.entryPrice * seed.riskPct;
  const sign = seed.direction === "Long" ? 1 : -1;
  return {
    id: seed.id,
    symbol: seed.symbol,
    direction: seed.direction,
    openedAt: seed.openedAt,
    closedAt: new Date(
      new Date(seed.openedAt).getTime() + seed.durationHours * 3_600_000
    ).toISOString(),
    resultR: seed.resultR,
    entryPrice: seed.entryPrice,
    exitPrice: seed.entryPrice + sign * riskDistance * seed.resultR,
    initialStop: seed.entryPrice - sign * riskDistance,
    mfeR: seed.mfeR,
    maeR: seed.maeR,
  };
}

const recent = [
  trade({ id: "btc-2026-09-15", symbol: "BTCUSDT", direction: "Long", openedAt: "2026-09-12T23:20:00.000Z", durationHours: 57.4, resultR: 2.15, entryPrice: 115_840, riskPct: 0.018, mfeR: 2.48, maeR: -0.38 }),
  trade({ id: "eth-2026-09-11", symbol: "ETHUSDT", direction: "Short", openedAt: "2026-09-10T01:10:00.000Z", durationHours: 31.7, resultR: -1.02, entryPrice: 4_365, riskPct: 0.022, mfeR: 0.42, maeR: -1.08 }),
  trade({ id: "sol-2026-09-08", symbol: "SOLUSDT", direction: "Long", openedAt: "2026-09-06T04:35:00.000Z", durationHours: 49.2, resultR: 1.38, entryPrice: 238.4, riskPct: 0.026, mfeR: 1.72, maeR: -0.31 }),
  trade({ id: "btc-2026-09-05", symbol: "BTCUSDT", direction: "Short", openedAt: "2026-09-03T22:45:00.000Z", durationHours: 38.5, resultR: 0.64, entryPrice: 112_920, riskPct: 0.016, mfeR: 1.12, maeR: -0.54 }),
  trade({ id: "eth-2026-09-02", symbol: "ETHUSDT", direction: "Long", openedAt: "2026-09-01T03:30:00.000Z", durationHours: 25.8, resultR: -0.58, entryPrice: 4_290, riskPct: 0.021, mfeR: 0.61, maeR: -0.72 }),
] satisfies PerformanceTrade[];

const historySeeds: SeedTrade[] = [
  { id: "btc-2026-08-27", symbol: "BTCUSDT", direction: "Long", openedAt: "2026-08-25T02:10:00Z", durationHours: 54, resultR: 1.74, entryPrice: 111400, riskPct: .017, mfeR: 2.1, maeR: -.42 },
  { id: "eth-2026-08-18", symbol: "ETHUSDT", direction: "Long", openedAt: "2026-08-16T05:40:00Z", durationHours: 47, resultR: -.91, entryPrice: 4180, riskPct: .021, mfeR: .33, maeR: -1.02 },
  { id: "sol-2026-08-07", symbol: "SOLUSDT", direction: "Short", openedAt: "2026-08-05T00:20:00Z", durationHours: 61, resultR: 2.42, entryPrice: 224, riskPct: .027, mfeR: 2.7, maeR: -.29 },
  { id: "btc-2026-07-29", symbol: "BTCUSDT", direction: "Short", openedAt: "2026-07-27T07:05:00Z", durationHours: 41, resultR: -.84, entryPrice: 109600, riskPct: .016, mfeR: .45, maeR: -.92 },
  { id: "eth-2026-07-17", symbol: "ETHUSDT", direction: "Long", openedAt: "2026-07-14T23:40:00Z", durationHours: 69, resultR: 1.12, entryPrice: 4010, riskPct: .022, mfeR: 1.57, maeR: -.48 },
  { id: "btc-2026-07-04", symbol: "BTCUSDT", direction: "Long", openedAt: "2026-07-02T03:25:00Z", durationHours: 50, resultR: .38, entryPrice: 107200, riskPct: .018, mfeR: 1.21, maeR: -.66 },
  { id: "sol-2026-06-23", symbol: "SOLUSDT", direction: "Long", openedAt: "2026-06-20T20:15:00Z", durationHours: 78, resultR: 2.08, entryPrice: 206, riskPct: .025, mfeR: 2.44, maeR: -.37 },
  { id: "eth-2026-06-09", symbol: "ETHUSDT", direction: "Short", openedAt: "2026-06-07T01:30:00Z", durationHours: 44, resultR: -1.04, entryPrice: 3870, riskPct: .02, mfeR: .17, maeR: -1.09 },
  { id: "btc-2026-05-26", symbol: "BTCUSDT", direction: "Long", openedAt: "2026-05-23T06:45:00Z", durationHours: 81, resultR: 1.66, entryPrice: 104300, riskPct: .017, mfeR: 2.02, maeR: -.51 },
  { id: "sol-2026-05-12", symbol: "SOLUSDT", direction: "Short", openedAt: "2026-05-10T00:10:00Z", durationHours: 52, resultR: .92, entryPrice: 198, riskPct: .028, mfeR: 1.43, maeR: -.71 },
  { id: "eth-2026-04-28", symbol: "ETHUSDT", direction: "Long", openedAt: "2026-04-25T04:20:00Z", durationHours: 72, resultR: -.62, entryPrice: 3690, riskPct: .023, mfeR: .78, maeR: -.81 },
  { id: "btc-2026-04-14", symbol: "BTCUSDT", direction: "Short", openedAt: "2026-04-11T23:50:00Z", durationHours: 65, resultR: 2.73, entryPrice: 101800, riskPct: .016, mfeR: 3.02, maeR: -.35 },
  { id: "btc-2026-03-24", symbol: "BTCUSDT", direction: "Long", openedAt: "2026-03-22T02:10:00Z", durationHours: 53, resultR: -.97, entryPrice: 98400, riskPct: .019, mfeR: .29, maeR: -1.04 },
  { id: "eth-2026-03-08", symbol: "ETHUSDT", direction: "Short", openedAt: "2026-03-05T21:30:00Z", durationHours: 75, resultR: 1.86, entryPrice: 3510, riskPct: .021, mfeR: 2.17, maeR: -.46 },
  { id: "sol-2026-02-19", symbol: "SOLUSDT", direction: "Long", openedAt: "2026-02-17T00:55:00Z", durationHours: 59, resultR: .71, entryPrice: 184, riskPct: .027, mfeR: 1.36, maeR: -.67 },
  { id: "btc-2026-02-03", symbol: "BTCUSDT", direction: "Long", openedAt: "2026-01-31T05:10:00Z", durationHours: 83, resultR: 2.31, entryPrice: 95600, riskPct: .018, mfeR: 2.69, maeR: -.27 },
  { id: "eth-2026-01-18", symbol: "ETHUSDT", direction: "Long", openedAt: "2026-01-15T01:40:00Z", durationHours: 70, resultR: -1.06, entryPrice: 3310, riskPct: .022, mfeR: .2, maeR: -1.11 },
  { id: "btc-2026-01-07", symbol: "BTCUSDT", direction: "Short", openedAt: "2026-01-04T22:25:00Z", durationHours: 77, resultR: 1.47, entryPrice: 93900, riskPct: .017, mfeR: 1.9, maeR: -.49 },
  { id: "sol-2025-12-18", symbol: "SOLUSDT", direction: "Long", openedAt: "2025-12-15T20:00:00Z", durationHours: 82, resultR: 2.16, entryPrice: 171, riskPct: .028, mfeR: 2.61, maeR: -.32 },
  { id: "btc-2025-11-27", symbol: "BTCUSDT", direction: "Short", openedAt: "2025-11-25T02:30:00Z", durationHours: 58, resultR: -.89, entryPrice: 91200, riskPct: .018, mfeR: .35, maeR: -.98 },
  { id: "eth-2025-10-21", symbol: "ETHUSDT", direction: "Long", openedAt: "2025-10-18T05:10:00Z", durationHours: 79, resultR: 1.28, entryPrice: 3180, riskPct: .023, mfeR: 1.83, maeR: -.56 },
  { id: "btc-2025-09-12", symbol: "BTCUSDT", direction: "Long", openedAt: "2025-09-09T23:50:00Z", durationHours: 88, resultR: 3.04, entryPrice: 88700, riskPct: .017, mfeR: 3.42, maeR: -.24 },
  { id: "sol-2025-08-06", symbol: "SOLUSDT", direction: "Short", openedAt: "2025-08-04T03:20:00Z", durationHours: 49, resultR: -.73, entryPrice: 164, riskPct: .026, mfeR: .62, maeR: -.85 },
  { id: "eth-2025-06-24", symbol: "ETHUSDT", direction: "Short", openedAt: "2025-06-21T01:10:00Z", durationHours: 91, resultR: 1.92, entryPrice: 2940, riskPct: .022, mfeR: 2.38, maeR: -.41 },
  { id: "btc-2025-05-09", symbol: "BTCUSDT", direction: "Long", openedAt: "2025-05-06T04:45:00Z", durationHours: 86, resultR: -1.08, entryPrice: 84600, riskPct: .019, mfeR: .11, maeR: -1.15 },
  { id: "btc-2025-03-19", symbol: "BTCUSDT", direction: "Short", openedAt: "2025-03-16T22:10:00Z", durationHours: 84, resultR: 1.51, entryPrice: 82100, riskPct: .018, mfeR: 1.96, maeR: -.45 },
  { id: "eth-2025-01-11", symbol: "ETHUSDT", direction: "Long", openedAt: "2025-01-08T02:20:00Z", durationHours: 94, resultR: .83, entryPrice: 2760, riskPct: .024, mfeR: 1.39, maeR: -.63 },
];

export const performanceDatasets: Record<PerformanceDataset["id"], PerformanceDataset> = {
  new: {
    id: "new",
    label: "New journal",
    description: "A realistic launch state with only recent results available.",
    inceptionAt: "2026-09-01T00:00:00.000Z",
    asOf: "2026-09-16T00:00:00.000Z",
    trades: recent,
  },
  mature: {
    id: "mature",
    label: "Full history",
    description: "A design fixture for checking longer ranges and yearly views.",
    inceptionAt: "2025-01-08T00:00:00.000Z",
    asOf: "2026-09-16T00:00:00.000Z",
    trades: [...recent, ...historySeeds.map(trade)].sort(
      (a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt)
    ),
  },
};

export const allMockTrades = performanceDatasets.mature.trades;

export function getMockTrade(id: string): PerformanceTrade | null {
  return allMockTrades.find((item) => item.id === id) ?? null;
}

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic candles shaped around the mock trade. */
export function createMockCandles(item: PerformanceTrade): TradeCandle[] {
  const start = Date.parse(item.openedAt);
  const end = Date.parse(item.closedAt);
  const durationHours = Math.max(1, (end - start) / 3_600_000);
  const intervalHours = durationHours <= 18 ? 0.25 : durationHours <= 72 ? 1 : 4;
  const count = Math.max(28, Math.min(160, Math.ceil(durationHours / intervalHours) + 20));
  const pad = Math.floor(count * 0.12);
  const intervalMs = intervalHours * 3_600_000;
  const first = start - pad * intervalMs;
  const risk = Math.abs(item.entryPrice - item.initialStop);
  const direction = item.direction === "Long" ? 1 : -1;
  const out: TradeCandle[] = [];
  let previous = item.entryPrice - direction * risk * 0.18;

  for (let i = 0; i < count; i += 1) {
    const time = first + i * intervalMs;
    const progress = Math.max(0, Math.min(1, (time - start) / Math.max(1, end - start)));
    const trend = item.entryPrice + (item.exitPrice - item.entryPrice) * progress;
    const wave = Math.sin(i * 0.7) * risk * 0.13 + (seededNoise(i + item.id.length) - 0.5) * risk * 0.18;
    const close = time < start ? item.entryPrice - direction * risk * (0.18 - i / count * 0.12) + wave : trend + wave;
    const open = previous;
    const wick = risk * (0.08 + seededNoise(i * 3 + 1) * 0.12);
    out.push({
      time: Math.floor(time / 1000),
      open,
      high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick,
      close,
    });
    previous = close;
  }
  return out;
}
