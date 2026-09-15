import type {
  PerformanceDataset,
  PerformanceTrade,
  TradeDirection,
} from "./types";

type MarketSnapshot = readonly [
  entryPrice: number,
  exitPrice: number,
  initialStop: number,
  resultR: number,
  mfeR: number,
  maeR: number,
];

/**
 * Hypothetical trade selections placed on real Bybit hourly market data.
 * Prices are the observed candle closes at the mock entry and exit. The stop
 * sits beyond the observed adverse excursion, with a 1.5 ATR floor.
 */
function trade(
  id: string,
  symbol: string,
  direction: TradeDirection,
  openedAt: string,
  durationHours: number,
  [entryPrice, exitPrice, initialStop, resultR, mfeR, maeR]: MarketSnapshot
): PerformanceTrade {
  return {
    id,
    symbol,
    direction,
    openedAt,
    closedAt: new Date(Date.parse(openedAt) + durationHours * 3_600_000).toISOString(),
    entryPrice,
    exitPrice,
    initialStop,
    resultR,
    mfeR,
    maeR,
  };
}

const recent = [
  trade("btc-2026-09-15", "BTCUSDT", "Long", "2026-09-12T23:20:00.000Z", 57.4, [77244.7, 76940, 76201.0333, -0.29, 2.24, -0.9]),
  trade("eth-2026-09-11", "ETHUSDT", "Short", "2026-09-10T01:10:00.000Z", 31.7, [2462.66, 2468.22, 2492.2357, -0.19, 2.01, -0.72]),
  trade("sol-2026-09-08", "SOLUSDT", "Long", "2026-09-06T04:35:00.000Z", 49.2, [106.38, 102.62, 101.68, -0.8, 0.2, -0.9]),
  trade("btc-2026-09-05", "BTCUSDT", "Short", "2026-09-03T22:45:00.000Z", 38.5, [81224.6, 79568.9, 82259.1929, 1.6, 2.53, -0.17]),
  trade("eth-2026-09-02", "ETHUSDT", "Long", "2026-09-01T03:30:00.000Z", 25.8, [2471.22, 2421.53, 2371.9978, -0.5, 0.14, -0.9]),
] satisfies PerformanceTrade[];

const history = [
  trade("btc-2026-08-27", "BTCUSDT", "Long", "2026-08-25T02:10:00Z", 54, [80621.8, 79724.2, 77212.4667, -0.26, 0.19, -0.9]),
  trade("eth-2026-08-18", "ETHUSDT", "Long", "2026-08-16T05:40:00Z", 47, [1880.01, 1894.44, 1866.5433, 1.07, 2.82, -0.9]),
  trade("sol-2026-08-07", "SOLUSDT", "Short", "2026-08-05T00:20:00Z", 61, [73.47, 74.08, 74.9589, -0.41, 0.81, -0.9]),
  trade("btc-2026-07-29", "BTCUSDT", "Short", "2026-07-27T07:05:00Z", 41, [65201.4, 63924.4, 65747.5111, 2.34, 4.57, -0.9]),
  trade("eth-2026-07-17", "ETHUSDT", "Long", "2026-07-14T23:40:00Z", 69, [1880.82, 1840.79, 1793.8644, -0.46, 0.75, -0.9]),
  trade("btc-2026-07-04", "BTCUSDT", "Long", "2026-07-02T03:25:00Z", 50, [61038.9, 62444.6, 59967.9, 1.31, 1.78, -0.9]),
  trade("sol-2026-06-23", "SOLUSDT", "Long", "2026-06-20T20:15:00Z", 78, [71.99, 69.41, 67.6122, -0.59, 0.68, -0.9]),
  trade("eth-2026-06-09", "ETHUSDT", "Short", "2026-06-07T01:30:00Z", 44, [1589.33, 1702.74, 1735.8522, -0.77, 0.18, -0.9]),
  trade("btc-2026-05-26", "BTCUSDT", "Long", "2026-05-23T06:45:00Z", 81, [74568.3, 76527.4, 73965.6964, 3.25, 5.78, -0.58]),
  trade("sol-2026-05-12", "SOLUSDT", "Short", "2026-05-10T00:10:00Z", 52, [92.97, 96.3, 98.9589, -0.56, 0.07, -0.9]),
  trade("eth-2026-04-28", "ETHUSDT", "Long", "2026-04-25T04:20:00Z", 72, [2315.46, 2287.29, 2258.3378, -0.49, 1.55, -0.9]),
  trade("btc-2026-04-14", "BTCUSDT", "Short", "2026-04-11T23:50:00Z", 65, [73042.5, 74701, 76340.0556, -0.5, 0.79, -0.9]),
  trade("btc-2026-03-24", "BTCUSDT", "Long", "2026-03-22T02:10:00Z", 53, [69236.2, 71269.9, 67084.9778, 0.95, 1.19, -0.9]),
  trade("eth-2026-03-08", "ETHUSDT", "Short", "2026-03-05T21:30:00Z", 75, [2079.36, 1949.76, 2125.2043, 2.83, 3.72, -0.43]),
  trade("sol-2026-02-19", "SOLUSDT", "Long", "2026-02-17T00:55:00Z", 59, [86.15, 80.76, 79.7944, -0.85, 0.24, -0.9]),
  trade("btc-2026-02-03", "BTCUSDT", "Long", "2026-01-31T05:10:00Z", 83, [83962.6, 76456, 73523.3778, -0.72, 0.01, -0.9]),
  trade("eth-2026-01-18", "ETHUSDT", "Long", "2026-01-15T01:40:00Z", 70, [3312.63, 3303, 3243.53, -0.14, 1.02, -0.9]),
  trade("btc-2026-01-07", "BTCUSDT", "Short", "2026-01-04T22:25:00Z", 77, [91167.7, 90760.1, 95147.9222, 0.1, 0.15, -0.9]),
  trade("sol-2025-12-18", "SOLUSDT", "Long", "2025-12-15T20:00:00Z", 82, [124.92, 123.39, 115.8089, -0.17, 0.99, -0.9]),
  trade("btc-2025-11-27", "BTCUSDT", "Short", "2025-11-25T02:30:00Z", 58, [87863.3, 90950.3, 92351.5222, -0.69, 0.4, -0.9]),
  trade("eth-2025-10-21", "ETHUSDT", "Long", "2025-10-18T05:10:00Z", 79, [3865.56, 3878.7, 3809.8918, 0.24, 3.94, -0.74]),
  trade("btc-2025-09-12", "BTCUSDT", "Long", "2025-09-09T23:50:00Z", 88, [110967.6, 115274.9, 110165.0571, 5.37, 7.02, -0.13]),
  trade("sol-2025-08-06", "SOLUSDT", "Short", "2025-08-04T03:20:00Z", 49, [162.86, 162.37, 172.7044, 0.05, 0.19, -0.9]),
  trade("eth-2025-06-24", "ETHUSDT", "Short", "2025-06-21T01:10:00Z", 91, [2430.01, 2447.71, 2487.6211, -0.31, 5.55, -0.9]),
  trade("btc-2025-05-09", "BTCUSDT", "Long", "2025-05-06T04:45:00Z", 86, [94291.4, 103135.8, 93227.0667, 8.31, 9.43, -0.9]),
  trade("btc-2025-03-19", "BTCUSDT", "Short", "2025-03-16T22:10:00Z", 84, [82048.1, 85124, 87994.6556, -0.52, 0.16, -0.9]),
  trade("eth-2025-01-11", "ETHUSDT", "Long", "2025-01-08T02:20:00Z", 94, [3380.57, 3282, 3130.4922, -0.39, 0.09, -0.9]),
] satisfies PerformanceTrade[];

export const performanceDatasets: Record<PerformanceDataset["id"], PerformanceDataset> = {
  new: {
    id: "new",
    label: "New journal",
    description: "Launch state",
    inceptionAt: "2026-09-01T00:00:00.000Z",
    asOf: "2026-09-16T00:00:00.000Z",
    trades: recent,
  },
  mature: {
    id: "mature",
    label: "Full history",
    description: "Long-term state",
    inceptionAt: "2025-01-08T00:00:00.000Z",
    asOf: "2026-09-16T00:00:00.000Z",
    trades: [...recent, ...history].sort(
      (a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt)
    ),
  },
};

export const allMockTrades = performanceDatasets.mature.trades;

export function getMockTrade(id: string): PerformanceTrade | null {
  return allMockTrades.find((item) => item.id === id) ?? null;
}
