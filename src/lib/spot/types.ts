/** Wire contracts only. Private ledger records are never public component props. */
export type SpotEventKind = "opening" | "buy" | "sell" | "deposit" | "withdrawal";
export type SpotSignal = "dcaBuy" | "washoutLump" | "divLump" | "divTrim";
export interface SpotEvent {
  id: string;
  kind: SpotEventKind;
  at: string;
  sequence: number;
  asset: string;
  quantity: string;
  price: string;
  fee: string;
  feeAsset: string;
  strategy: string;
  campaignId: string | null;
  decisionId: string | null;
  publicReason: string;
  privateNote: string;
  articleUrl?: string | null;
  signal: { type: SpotSignal; provenance: "illustrative" | "retrospective" | "captured"; at: string; reference: string } | null;
  voided: boolean;
}
export interface SpotCampaign {
  id: string;
  name: string;
  asset: string;
  strategy: string;
  cadenceDays: number;
  budgetUSDT: string;
  startAt: string;
  status: "active" | "paused" | "completed";
  publicReason: string;
  direction?: "buy" | "sell";
  durationDays?: number | null;
  showBudgetPublic?: boolean;
  articleUrl?: string | null;
}
export interface SpotMark { asset: string; at: string; price: string }
export interface SpotLedger {
  mode: "demo";
  inceptionAt: string;
  asOf: string;
  events: SpotEvent[];
  campaigns: SpotCampaign[];
  marks: SpotMark[];
}
export interface SpotPoint {
  at: string;
  portfolioIndex: number;
  btcIndex: number;
  weights: Record<string, number>;
}
export interface PublicSpotActivity {
  id: string;
  at: string;
  kind: SpotEventKind;
  asset: string;
  campaignId: string | null;
  articleUrl: string | null;
  decisionId: string | null;
  reason: string;
  weightBefore: number;
  weightAfter: number;
  realisedReturnPct: number | null;
}
export interface PublicSpotDataset {
  mode: "demo";
  currency: "USDT";
  inceptionAt: string;
  asOf: string;
  lastActivityAt: string;
  publishedAt: string | null;
  release: number;
  points: SpotPoint[];
  holdings: { asset: string; weight: number }[];
  activity: PublicSpotActivity[];
  campaigns: PublicSpotCampaign[];
}
export interface PrivateSpotSummary {
  value: string;
  openingValue: string;
  netContributions: string;
  pnl: string;
  realisedPnl: string;
  unrealisedPnl: string;
  fees: string;
  positions: { asset: string; quantity: string; price: string; value: string; cost: string; unrealisedPnl: string; weight: number }[];
}
export interface SpotAdminSnapshot {
  revision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
  persisted: boolean;
  draft: SpotLedger;
  preview: PublicSpotDataset;
  published: PublicSpotDataset | null;
  summary: PrivateSpotSummary;
  fingerprint: string;
  audit: { at: string; action: string; revision: number }[];
}
export interface SpotInstrument { asset: string; symbol: string }

export interface PublicSpotCampaign {
  id: string;
  name: string;
  asset: string;
  direction: "buy" | "sell";
  status: SpotCampaign["status"];
  reason: string;
  startAt: string | null;
  durationDays: number | null;
  cadenceDays: number;
  recordedFills: number;
  amountPerIntervalUSDT: string | null;
  articleUrl: string | null;
}
