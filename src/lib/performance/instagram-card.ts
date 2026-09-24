import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { signedR, sydneyDateKey } from "./metrics";
import type { PerformanceTrade, TradeCandle, TradeCandleSource } from "./types";

const WIDTH = 1080;
const HEIGHT = 1350;
const GREEN = "#22c55e";
const RED = "#ef4444";
const ORANGE = "#ff6719";

const FRAME = { left: 60, top: 360, right: 1020, bottom: 980 };
const PLOT = { left: 80, top: 382, right: 925, bottom: 957 };
const PRICE_RAIL_X = 937;

const cardDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function duration(openedAt: string, closedAt: string): string {
  const hours = Math.max(0, (Date.parse(closedAt) - Date.parse(openedAt)) / 3_600_000);
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours - days * 24);
  return days ? `${days}d ${remainingHours}h` : `${Math.round(hours)}h`;
}

function nearestIndex(candles: TradeCandle[], target: number): number {
  return candles.reduce(
    (best, candle, index) =>
      Math.abs(candle.time - target) < Math.abs(candles[best].time - target)
        ? index
        : best,
    0
  );
}

function visibleCandles(trade: PerformanceTrade, candles: TradeCandle[]): TradeCandle[] {
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const entry = nearestIndex(sorted, Math.floor(Date.parse(trade.openedAt) / 1000));
  const exit = nearestIndex(sorted, Math.floor(Date.parse(trade.closedAt) / 1000));
  return sorted.slice(Math.max(0, Math.min(entry, exit) - 5), Math.min(sorted.length, Math.max(entry, exit) + 3));
}

function niceStep(range: number): number {
  const raw = range / 7.5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return factor * power;
}

function priceTicks(min: number, max: number): { value: number; label: string }[] {
  const step = niceStep(max - min);
  const decimals = step >= 1 ? 2 : Math.min(4, Math.max(2, Math.ceil(-Math.log10(step)) + 1));
  const first = Math.ceil(min / step) * step;
  const ticks: { value: number; label: string }[] = [];
  for (let value = first; value <= max + step * 0.001; value += step) {
    ticks.push({ value, label: value.toFixed(decimals) });
  }
  return ticks;
}

function candleSvg(
  trade: PerformanceTrade,
  candles: TradeCandle[],
  minPrice: number,
  maxPrice: number
): string {
  const x = (index: number) =>
    PLOT.left + index * (PLOT.right - PLOT.left) / Math.max(1, candles.length - 1);
  const y = (price: number) =>
    PLOT.top + (maxPrice - price) * (PLOT.bottom - PLOT.top) / (maxPrice - minPrice);
  const entryIndex = nearestIndex(candles, Math.floor(Date.parse(trade.openedAt) / 1000));
  const exitIndex = nearestIndex(candles, Math.floor(Date.parse(trade.closedAt) / 1000));
  const spacing = (PLOT.right - PLOT.left) / Math.max(1, candles.length - 1);
  const bodyWidth = Math.max(5, spacing * 0.56);
  const entryX = x(entryIndex);
  const exitX = x(exitIndex);
  const entryY = y(trade.entryPrice);
  const exitY = y(trade.exitPrice);
  const directionColor = trade.direction === "Long" ? GREEN : RED;
  const exitColor = trade.direction === "Long" ? RED : GREEN;
  let activeLeft = Math.min(entryX, exitX);
  let activeRight = Math.max(entryX, exitX);
  if (activeRight - activeLeft < spacing) {
    activeLeft = Math.max(PLOT.left, activeLeft - spacing / 2);
    activeRight = Math.min(PLOT.right, activeRight + spacing / 2);
  }

  const activeZones = trade.direction === "Long"
    ? `<rect x="${activeLeft}" y="${PLOT.top}" width="${activeRight - activeLeft}" height="${entryY - PLOT.top}" fill="${GREEN}" fill-opacity="0.075"/><rect x="${activeLeft}" y="${entryY}" width="${activeRight - activeLeft}" height="${PLOT.bottom - entryY}" fill="${RED}" fill-opacity="0.075"/>`
    : `<rect x="${activeLeft}" y="${PLOT.top}" width="${activeRight - activeLeft}" height="${entryY - PLOT.top}" fill="${RED}" fill-opacity="0.075"/><rect x="${activeLeft}" y="${entryY}" width="${activeRight - activeLeft}" height="${PLOT.bottom - entryY}" fill="${GREEN}" fill-opacity="0.075"/>`;

  const candleShapes = candles.map((candle, index) => {
    const centre = x(index);
    const color = candle.close >= candle.open ? GREEN : RED;
    const bodyTop = Math.min(y(candle.open), y(candle.close));
    const bodyHeight = Math.max(2, Math.abs(y(candle.open) - y(candle.close)));
    return `<line x1="${centre}" x2="${centre}" y1="${y(candle.high)}" y2="${y(candle.low)}" stroke="${color}" stroke-width="2"/><rect x="${centre - bodyWidth / 2}" y="${bodyTop}" width="${bodyWidth}" height="${bodyHeight}" fill="${color}"/>`;
  }).join("");

  return `${activeZones}${candleShapes}<rect x="${PLOT.left}" y="${PLOT.top}" width="${Math.max(0, activeLeft - PLOT.left)}" height="${PLOT.bottom - PLOT.top}" fill="#000" fill-opacity="0.25"/><rect x="${activeRight}" y="${PLOT.top}" width="${Math.max(0, PLOT.right - activeRight)}" height="${PLOT.bottom - PLOT.top}" fill="#000" fill-opacity="0.25"/><line x1="${activeLeft}" x2="${activeLeft}" y1="${PLOT.top}" y2="${PLOT.bottom}" stroke="${ORANGE}" stroke-opacity="0.65"/><line x1="${activeRight}" x2="${activeRight}" y1="${PLOT.top}" y2="${PLOT.bottom}" stroke="${ORANGE}" stroke-opacity="0.65"/><line x1="${activeLeft}" x2="${activeRight}" y1="${entryY}" y2="${entryY}" stroke="${directionColor}" stroke-width="2" stroke-dasharray="3 3"/><rect x="${Math.min(activeLeft + 22, activeRight - 124)}" y="${PLOT.top + 34}" width="118" height="54" rx="8" fill="#050505" fill-opacity="0.9" stroke="${ORANGE}" stroke-opacity="0.45"/><text x="${Math.min(activeLeft + 81, activeRight - 65)}" y="${PLOT.top + 68}" fill="#ff8b52" font-size="20" font-weight="700" letter-spacing="2" text-anchor="middle">${trade.direction.toUpperCase()}</text><circle cx="${entryX}" cy="${entryY}" r="12" fill="${directionColor}"/><circle cx="${exitX}" cy="${exitY}" r="12" fill="${exitColor}"/>`;
}

function buildCardSvg(trade: PerformanceTrade, sourceCandles: TradeCandle[]): string {
  const candles = visibleCandles(trade, sourceCandles);
  if (!candles.length) throw new Error("No candles are available for the Instagram card");

  const rawMin = Math.min(...sourceCandles.map((candle) => candle.low), trade.entryPrice, trade.exitPrice);
  const rawMax = Math.max(...sourceCandles.map((candle) => candle.high), trade.entryPrice, trade.exitPrice);
  const padding = Math.max(1, (rawMax - rawMin) * 0.08);
  const minPrice = rawMin - padding;
  const maxPrice = rawMax + padding;
  const ticks = priceTicks(minPrice, maxPrice);
  const y = (price: number) =>
    PLOT.top + (maxPrice - price) * (PLOT.bottom - PLOT.top) / (maxPrice - minPrice);
  const tickMarkup = ticks.map(({ value, label }) => {
    const tickY = y(value);
    return `<line x1="${PRICE_RAIL_X}" x2="${PRICE_RAIL_X + 10}" y1="${tickY}" y2="${tickY}" stroke="#fff" stroke-opacity="0.10"/><text x="995" y="${tickY + 6}" fill="#71717a" font-size="16" text-anchor="end">${label}</text>`;
  }).join("");
  const gridMarkup = ticks.map(({ value }) => {
    const tickY = y(value);
    return `<line x1="${PLOT.left}" x2="${PRICE_RAIL_X}" y1="${tickY}" y2="${tickY}" stroke="#fff" stroke-opacity="0.045"/>`;
  }).join("");
  const verticalGrid = [0.2, 0.4, 0.6, 0.8].map((ratio) => {
    const gridX = PLOT.left + (PLOT.right - PLOT.left) * ratio;
    return `<line x1="${gridX}" x2="${gridX}" y1="${PLOT.top}" y2="${PLOT.bottom}" stroke="#fff" stroke-opacity="0.04"/>`;
  }).join("");
  const directionColor = trade.direction === "Long" ? GREEN : RED;
  const pair = trade.symbol.endsWith("USDT")
    ? `${trade.symbol.slice(0, -4)} / USDT`
    : trade.symbol;
  const result = signedR(trade.resultR);
  const titleSize = pair.length > 11 ? 56 : 66;
  const resultSize = result.length > 7 ? 76 : 88;

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#080402"/><stop offset="0.45" stop-color="#030304"/><stop offset="1" stop-color="#090a0d"/></linearGradient><radialGradient id="glow" cx="0.12" cy="0.05" r="0.72"><stop offset="0" stop-color="${ORANGE}" stop-opacity="0.18"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient><filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="18" stdDeviation="30" flood-color="#000" flood-opacity="0.52"/></filter><clipPath id="chartClip"><rect x="${FRAME.left}" y="${FRAME.top}" width="${FRAME.right - FRAME.left}" height="${FRAME.bottom - FRAME.top}" rx="24"/></clipPath></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/><rect width="${WIDTH}" height="8" fill="${ORANGE}"/><g font-family="Arial,Helvetica,sans-serif"><text x="60" y="70" fill="#ff8b52" font-size="18" font-weight="700" letter-spacing="4.5">PERFORMANCE JOURNAL</text><text x="60" y="158" fill="#f4f4f5" font-size="${titleSize}" font-weight="600" letter-spacing="-2">${escapeXml(pair)}</text><rect x="60" y="192" width="150" height="48" rx="24" fill="${directionColor}" fill-opacity="0.11" stroke="${directionColor}" stroke-opacity="0.72"/><text x="85" y="224" fill="${directionColor}" font-size="19" font-weight="700" letter-spacing="2.7">${trade.direction.toUpperCase()} ${trade.direction === "Long" ? "↑" : "↓"}</text><text x="704" y="84" fill="#71717a" font-size="15" font-weight="700" letter-spacing="2.8">NET RESULT</text><text x="694" y="180" fill="#f4f4f5" font-size="${resultSize}" font-weight="600" letter-spacing="-4.5">${escapeXml(result)}</text><line x1="60" x2="1020" y1="270" y2="270" stroke="#fff" stroke-opacity="0.08"/><text x="60" y="311" fill="#a1a1aa" font-size="22">${escapeXml(cardDate.format(new Date(trade.openedAt)))} → ${escapeXml(cardDate.format(new Date(trade.closedAt)))}</text><text x="1020" y="311" fill="#71717a" font-size="20" text-anchor="end">${escapeXml(duration(trade.openedAt, trade.closedAt))} · Closed trade</text><rect x="${FRAME.left}" y="${FRAME.top}" width="${FRAME.right - FRAME.left}" height="${FRAME.bottom - FRAME.top}" rx="24" fill="#07090d" filter="url(#shadow)"/><g clip-path="url(#chartClip)">${gridMarkup}${verticalGrid}${candleSvg(trade, candles, minPrice, maxPrice)}<rect x="${PRICE_RAIL_X}" y="${FRAME.top}" width="${FRAME.right - PRICE_RAIL_X}" height="${FRAME.bottom - FRAME.top}" fill="#07090d"/><line x1="${PRICE_RAIL_X}" x2="${PRICE_RAIL_X}" y1="${PLOT.top}" y2="${PLOT.bottom}" stroke="#fff" stroke-opacity="0.08"/>${tickMarkup}</g><rect x="${FRAME.left + 0.5}" y="${FRAME.top + 0.5}" width="${FRAME.right - FRAME.left - 1}" height="${FRAME.bottom - FRAME.top - 1}" rx="23.5" fill="none" stroke="#fff" stroke-opacity="0.11"/><text x="84" y="1025" fill="#71717a" font-size="17" font-weight="600" letter-spacing="2">BINANCE 1H</text><text x="1020" y="1025" fill="#52525b" font-size="17" text-anchor="end">ENTRY → EXIT</text><line x1="60" x2="1020" y1="1170" y2="1170" stroke="#fff" stroke-opacity="0.08"/><text x="60" y="1230" fill="#d4d4d8" font-size="22" font-weight="700">THOMAS JOHNSTON</text><text x="1020" y="1230" fill="#71717a" font-size="20" text-anchor="end">mentor.thomas-johnston.com/performance</text></g></svg>`;
}

export async function renderInstagramTradeCard({
  trade,
  candles,
  source,
  outputPath,
}: {
  trade: PerformanceTrade;
  candles: TradeCandle[];
  source: TradeCandleSource;
  outputPath: string;
}): Promise<void> {
  if (!candles.length) throw new Error("Cannot render an Instagram card without market candles");
  await mkdir(dirname(outputPath), { recursive: true });
  const svg = buildCardSvg(trade, candles).replace(
    ">BINANCE 1H<",
    `>${source.toUpperCase()} 1H<`
  );
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);
}

export function defaultInstagramCardFilename(trade: PerformanceTrade): string {
  const symbol = trade.symbol.toLowerCase().replace("usdt", "-usdt");
  return `${symbol}-${trade.direction.toLowerCase()}-${sydneyDateKey(trade.closedAt)}-instagram-4x5.png`;
}
