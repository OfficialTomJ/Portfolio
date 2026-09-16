export type TradeDirection = "Long" | "Short";
export type PerformanceRange = "30D" | "60D" | "90D" | "6M" | "YTD" | "YEAR" | "CUSTOM";

export interface PerformanceTrade {
  id: string;
  symbol: string;
  direction: TradeDirection;
  openedAt: string;
  closedAt: string;
  resultR: number;
  entryPrice: number;
  exitPrice: number;
  initialStop: number;
  mfeR: number;
  maeR: number;
}

export interface PerformanceDataset {
  id: "new" | "mature";
  label: string;
  description: string;
  inceptionAt: string;
  asOf: string;
  trades: PerformanceTrade[];
}

export interface PerformanceStats {
  totalR: number;
  tradeCount: number;
  winRate: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  maxDrawdown: number;
  averageWinner: number | null;
  averageLoser: number | null;
}

export interface EquityPoint {
  time: number;
  value: number;
}

export interface PerformanceView {
  trades: PerformanceTrade[];
  stats: PerformanceStats;
  equity: EquityPoint[];
  startsAt: Date;
  endsAt: Date;
  isPartial: boolean;
}

export interface TradeCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
