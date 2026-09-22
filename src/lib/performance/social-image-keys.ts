import { createHash } from "node:crypto";
import type { PerformanceDataset, PerformanceTrade, PerformanceView } from "./types";
import { PERFORMANCE_SOCIAL_IMAGE_RENDERER_VERSION } from "./social-image-types";

const PUBLIC_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,199}$/;

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function tradePayload(trade: PerformanceTrade) {
  return {
    id: trade.id,
    symbol: trade.symbol,
    direction: trade.direction,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    resultR: trade.resultR,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
  };
}

export function tradeSocialImageKey(trade: PerformanceTrade): string {
  return `trade-${trade.id}-${fingerprint(tradePayload(trade))}-r${PERFORMANCE_SOCIAL_IMAGE_RENDERER_VERSION}`;
}

export function journalSocialImageKey(
  dataset: PerformanceDataset,
  view: PerformanceView
): string {
  const year = view.endsAt.getUTCFullYear();
  const trades = [...view.trades]
    .sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt))
    .map(tradePayload);
  return `journal-ytd-${year}-${fingerprint({ inceptionAt: dataset.inceptionAt, trades })}-r${PERFORMANCE_SOCIAL_IMAGE_RENDERER_VERSION}`;
}

export function legacyJournalImageVersion(view: PerformanceView): string {
  const latestTrade = view.trades[0];
  return `${view.stats.tradeCount}-${latestTrade?.id ?? "empty"}-${view.stats.totalR.toFixed(4)}`;
}

export function tradeLegacyImageKey(tradeId: string): string {
  return `trade:${tradeId}`;
}

export function journalLegacyImageKey(version: string): string {
  return `journal:${version}`;
}

export function socialImagePath(publicKey: string): string {
  if (!PUBLIC_KEY_PATTERN.test(publicKey)) throw new Error("Invalid performance image key");
  return `/api/performance/images/${publicKey}.png`;
}

export function parseSocialImagePathKey(value: string): string | null {
  const publicKey = value.endsWith(".png") ? value.slice(0, -4) : value;
  return PUBLIC_KEY_PATTERN.test(publicKey) ? publicKey : null;
}
