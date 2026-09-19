import type { CSSProperties, ReactNode } from "react";
import type { PerformanceTrade, TradeCandle } from "./types";
import { signedR } from "./metrics";

const GREEN = "#22c55e";
const RED = "#ef4444";
const ORANGE = "#ff6719";

const shortDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function duration(openedAt: string, closedAt: string): string {
  const hours = (Date.parse(closedAt) - Date.parse(openedAt)) / 3_600_000;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours - days * 24);
  return days ? `${days}d ${remaining}h` : `${Math.round(hours)}h`;
}

function nearestIndex(candles: TradeCandle[], target: number): number {
  return candles.reduce(
    (best, item, index) =>
      Math.abs(item.time - target) < Math.abs(candles[best].time - target) ? index : best,
    0
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 422,
        top: 108,
        width: 718,
        height: 386,
        display: "flex",
        overflow: "hidden",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.11)",
        background: "#07090d",
      }}
    >
      {children}
    </div>
  );
}

function TradeChart({ trade, candles }: { trade: PerformanceTrade; candles: TradeCandle[] }) {
  if (!candles.length) {
    return (
      <ChartFrame>
        <div style={{ margin: "auto", display: "flex", color: "#52525b", fontSize: 18 }}>
          Market chart unavailable
        </div>
      </ChartFrame>
    );
  }

  const plot = { left: 26, right: 692, top: 32, bottom: 362 };
  const rawMin = Math.min(...candles.map((item) => item.low), trade.entryPrice, trade.exitPrice);
  const rawMax = Math.max(...candles.map((item) => item.high), trade.entryPrice, trade.exitPrice);
  const padding = Math.max(1, (rawMax - rawMin) * 0.08);
  const minPrice = rawMin - padding;
  const maxPrice = rawMax + padding;
  const x = (index: number) => plot.left + index * (plot.right - plot.left) / Math.max(1, candles.length - 1);
  const y = (value: number) => plot.top + (maxPrice - value) * (plot.bottom - plot.top) / (maxPrice - minPrice);
  const entryIndex = nearestIndex(candles, Math.floor(Date.parse(trade.openedAt) / 1000));
  const exitIndex = nearestIndex(candles, Math.floor(Date.parse(trade.closedAt) / 1000));
  const entryX = x(entryIndex);
  const exitX = x(exitIndex);
  const entryY = y(trade.entryPrice);
  const exitY = y(trade.exitPrice);
  const activeLeft = Math.min(entryX, exitX);
  const activeRight = Math.max(entryX, exitX);
  const barWidth = Math.max(1.6, (plot.right - plot.left) / candles.length * 0.62);
  const directionColor = trade.direction === "Long" ? GREEN : RED;
  const resultColor = trade.resultR >= 0 ? GREEN : RED;

  return (
    <ChartFrame>
      {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
        <div key={`h-${ratio}`} style={{ position: "absolute", left: 0, right: 0, top: plot.top + (plot.bottom - plot.top) * ratio, height: 1, background: "rgba(255,255,255,0.045)" }} />
      ))}
      {[0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((ratio) => (
        <div key={`v-${ratio}`} style={{ position: "absolute", top: 0, bottom: 0, left: 718 * ratio, width: 1, background: "rgba(255,255,255,0.04)" }} />
      ))}

      {candles.map((candle, index) => {
        const centre = x(index);
        const wickTop = y(candle.high);
        const wickBottom = y(candle.low);
        const bodyTop = Math.min(y(candle.open), y(candle.close));
        const bodyBottom = Math.max(y(candle.open), y(candle.close));
        const color = candle.close >= candle.open ? GREEN : RED;
        return (
          <div key={candle.time} style={{ position: "absolute", display: "flex", left: centre, top: 0, width: 1, height: 386 }}>
            <div style={{ position: "absolute", left: 0, top: wickTop, width: 1, height: Math.max(1, wickBottom - wickTop), background: color }} />
            <div style={{ position: "absolute", left: -barWidth / 2, top: bodyTop, width: barWidth, height: Math.max(1, bodyBottom - bodyTop), background: color }} />
          </div>
        );
      })}

      <div style={{ position: "absolute", left: 0, top: 0, width: Math.max(0, activeLeft), height: 386, background: "rgba(0,0,0,0.25)" }} />
      <div style={{ position: "absolute", left: activeRight, top: 0, width: Math.max(0, 718 - activeRight), height: 386, background: "rgba(0,0,0,0.25)" }} />
      <div style={{ position: "absolute", left: activeLeft, top: plot.top, width: activeRight - activeLeft, height: Math.max(0, entryY - plot.top), background: trade.direction === "Long" ? "rgba(34,197,94,0.075)" : "rgba(239,68,68,0.075)" }} />
      <div style={{ position: "absolute", left: activeLeft, top: entryY, width: activeRight - activeLeft, height: Math.max(0, plot.bottom - entryY), background: trade.direction === "Long" ? "rgba(239,68,68,0.075)" : "rgba(34,197,94,0.075)" }} />
      <div style={{ position: "absolute", left: activeLeft, top: 20, width: 1, height: 345, background: "rgba(255,103,25,0.55)" }} />
      <div style={{ position: "absolute", left: activeRight, top: 20, width: 1, height: 345, background: "rgba(255,103,25,0.55)" }} />
      <div style={{ position: "absolute", left: activeLeft, top: entryY, width: activeRight - activeLeft, height: 1, borderTop: `1px dashed ${directionColor}` }} />

      <div style={{ position: "absolute", display: "flex", left: activeLeft + 14, top: 34, padding: "7px 14px", borderRadius: 6, border: "1px solid rgba(255,103,25,0.35)", background: "rgba(5,5,5,0.88)", color: "#ff8b52", fontSize: 13, fontWeight: 700, letterSpacing: 1.7 }}>
        {trade.direction.toUpperCase()} ACTIVE
      </div>

      <div style={{ position: "absolute", display: "flex", left: entryX - 7, top: entryY - 7, width: 14, height: 14, borderRadius: 999, background: directionColor }} />
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", left: entryX + 14, top: entryY - 21, width: 112, height: 40, padding: "5px 12px", borderRadius: 7, border: `1px solid ${directionColor}66`, background: "#050505" }}>
        <div style={{ display: "flex", color: "#a1a1aa", fontSize: 11, fontWeight: 600, letterSpacing: 1.1 }}>ENTRY</div>
        <div style={{ display: "flex", color: "#f4f4f5", fontSize: 14, fontWeight: 600 }}>{Math.round(trade.entryPrice).toLocaleString("en-US")}</div>
      </div>

      <div style={{ position: "absolute", display: "flex", left: exitX - 7, top: exitY - 7, width: 14, height: 14, borderRadius: 999, background: resultColor }} />
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", left: exitX - 128, top: exitY - 21, width: 112, height: 40, padding: "5px 12px", borderRadius: 7, border: `1px solid ${resultColor}66`, background: "#050505" }}>
        <div style={{ display: "flex", color: "#a1a1aa", fontSize: 11, fontWeight: 600, letterSpacing: 1.1 }}>EXIT</div>
        <div style={{ display: "flex", color: "#f4f4f5", fontSize: 14, fontWeight: 600 }}>{Math.round(trade.exitPrice).toLocaleString("en-US")}</div>
      </div>
    </ChartFrame>
  );
}

export function tradeOpenGraphAlt(trade: PerformanceTrade): string {
  return `${trade.symbol.replace("USDT", " / USDT")} ${trade.direction.toLowerCase()} trade, closed at ${signedR(trade.resultR)}, with entry and exit chart from ${shortDate.format(new Date(trade.openedAt))} to ${shortDate.format(new Date(trade.closedAt))}.`;
}

export function TradeOpenGraphCard({
  trade,
  candles,
}: {
  trade: PerformanceTrade;
  candles: TradeCandle[];
}) {
  const directionColor = trade.direction === "Long" ? GREEN : RED;
  const rootStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    width: 1200,
    height: 630,
    overflow: "hidden",
    color: "white",
    background: "radial-gradient(circle at 18% 12%, rgba(255,103,25,0.13), transparent 44%), linear-gradient(135deg, #020203 0%, #090a0d 100%)",
    fontFamily: "sans-serif",
  };

  return (
    <div style={rootStyle}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 5, background: ORANGE }} />
      <div style={{ position: "absolute", display: "flex", left: 60, top: 57, color: "#ff8b52", fontSize: 18, fontWeight: 700, letterSpacing: 3.6 }}>PERFORMANCE JOURNAL</div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 108, fontSize: 54, fontWeight: 600, letterSpacing: -1.8 }}>{trade.symbol.replace("USDT", " / USDT")}</div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 184, padding: "9px 26px", borderRadius: 999, border: `1px solid ${directionColor}7a`, background: `${directionColor}1f`, color: directionColor, fontSize: 17, fontWeight: 700, letterSpacing: 2.3 }}>
        {trade.direction.toUpperCase()} {trade.direction === "Long" ? "↑" : "↓"}
      </div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 318, color: "#71717a", fontSize: 15, fontWeight: 600, letterSpacing: 2.5 }}>NET RESULT</div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 344, color: "#f4f4f5", fontSize: 78, fontWeight: 600, letterSpacing: -3 }}>{signedR(trade.resultR)}</div>
      <div style={{ position: "absolute", left: 60, top: 450, width: 294, height: 1, background: "rgba(255,255,255,0.09)" }} />
      <div style={{ position: "absolute", display: "flex", left: 60, top: 468, color: "#a1a1aa", fontSize: 19 }}>{shortDate.format(new Date(trade.openedAt))} → {shortDate.format(new Date(trade.closedAt))}</div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 503, color: "#71717a", fontSize: 17 }}>{duration(trade.openedAt, trade.closedAt)} · Closed trade</div>

      <TradeChart trade={trade} candles={candles} />
      <div style={{ position: "absolute", display: "flex", left: 446, top: 514, color: "#71717a", fontSize: 13, letterSpacing: 1.1 }}>BINANCE 1H · PUBLIC ASSET PRICES · NO POSITION SIZING</div>
      <div style={{ position: "absolute", display: "flex", right: 60, top: 514, color: "#52525b", fontSize: 13 }}>Entry → exit</div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 560, height: 1, background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", display: "flex", left: 60, top: 581, color: "#d4d4d8", fontSize: 17, fontWeight: 600 }}>THOMAS JOHNSTON</div>
      <div style={{ position: "absolute", display: "flex", right: 60, top: 581, color: "#71717a", fontSize: 16 }}>mentor.thomas-johnston.com/performance</div>
    </div>
  );
}
