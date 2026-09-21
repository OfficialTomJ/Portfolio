import type { CSSProperties, ReactNode } from "react";
import type {
  PerformanceDataset,
  PerformanceTrade,
  PerformanceView,
  TradeCandle,
} from "./types";
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
  const exitActionColor = trade.direction === "Long" ? RED : GREEN;
  const paths = {
    greenWicks: [] as string[],
    greenBodies: [] as string[],
    redWicks: [] as string[],
    redBodies: [] as string[],
  };
  candles.forEach((candle, index) => {
    const centre = x(index);
    const wickTop = y(candle.high);
    const wickBottom = y(candle.low);
    const bodyTop = Math.min(y(candle.open), y(candle.close));
    const bodyBottom = Math.max(y(candle.open), y(candle.close));
    const prefix = candle.close >= candle.open ? "green" : "red";
    paths[`${prefix}Wicks`].push(
      `M${centre.toFixed(1)} ${wickTop.toFixed(1)}V${wickBottom.toFixed(1)}`
    );
    paths[`${prefix}Bodies`].push(
      `M${(centre - barWidth / 2).toFixed(1)} ${bodyTop.toFixed(1)}H${(centre + barWidth / 2).toFixed(1)}V${Math.max(bodyTop + 1, bodyBottom).toFixed(1)}H${(centre - barWidth / 2).toFixed(1)}Z`
    );
  });

  return (
    <ChartFrame>
      {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
        <div key={`h-${ratio}`} style={{ position: "absolute", left: 0, right: 0, top: plot.top + (plot.bottom - plot.top) * ratio, height: 1, background: "rgba(255,255,255,0.045)" }} />
      ))}
      {[0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((ratio) => (
        <div key={`v-${ratio}`} style={{ position: "absolute", top: 0, bottom: 0, left: 718 * ratio, width: 1, background: "rgba(255,255,255,0.04)" }} />
      ))}

      <svg width="718" height="386" viewBox="0 0 718 386" style={{ position: "absolute", left: 0, top: 0 }}>
        <path d={paths.greenWicks.join("")} fill="none" stroke={GREEN} strokeWidth="1" />
        <path d={paths.greenBodies.join("")} fill={GREEN} />
        <path d={paths.redWicks.join("")} fill="none" stroke={RED} strokeWidth="1" />
        <path d={paths.redBodies.join("")} fill={RED} />
      </svg>

      <div style={{ position: "absolute", left: 0, top: 0, width: Math.max(0, activeLeft), height: 386, background: "rgba(0,0,0,0.25)" }} />
      <div style={{ position: "absolute", left: activeRight, top: 0, width: Math.max(0, 718 - activeRight), height: 386, background: "rgba(0,0,0,0.25)" }} />
      <div style={{ position: "absolute", left: activeLeft, top: plot.top, width: activeRight - activeLeft, height: Math.max(0, entryY - plot.top), background: trade.direction === "Long" ? "rgba(34,197,94,0.075)" : "rgba(239,68,68,0.075)" }} />
      <div style={{ position: "absolute", left: activeLeft, top: entryY, width: activeRight - activeLeft, height: Math.max(0, plot.bottom - entryY), background: trade.direction === "Long" ? "rgba(239,68,68,0.075)" : "rgba(34,197,94,0.075)" }} />
      <div style={{ position: "absolute", left: activeLeft, top: 20, width: 1, height: 345, background: "rgba(255,103,25,0.55)" }} />
      <div style={{ position: "absolute", left: activeRight, top: 20, width: 1, height: 345, background: "rgba(255,103,25,0.55)" }} />
      <div style={{ position: "absolute", left: activeLeft, top: entryY, width: activeRight - activeLeft, height: 1, borderTop: `1px dashed ${directionColor}` }} />

      <div style={{ position: "absolute", display: "flex", left: activeLeft + 14, top: 34, padding: "7px 14px", borderRadius: 6, border: "1px solid rgba(255,103,25,0.35)", background: "rgba(5,5,5,0.88)", color: "#ff8b52", fontSize: 13, fontWeight: 700, letterSpacing: 1.7 }}>
        {trade.direction.toUpperCase()}
      </div>

      <div style={{ position: "absolute", display: "flex", left: entryX - 7, top: entryY - 7, width: 14, height: 14, borderRadius: 999, background: directionColor }} />
      <div style={{ position: "absolute", display: "flex", left: exitX - 7, top: exitY - 7, width: 14, height: 14, borderRadius: 999, background: exitActionColor }} />
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
      <div style={{ position: "absolute", display: "flex", left: 446, top: 514, color: "#71717a", fontSize: 13, letterSpacing: 1.1 }}>BINANCE 1H</div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 560, height: 1, background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", display: "flex", left: 60, top: 581, color: "#d4d4d8", fontSize: 17, fontWeight: 600 }}>THOMAS JOHNSTON</div>
      <div style={{ position: "absolute", display: "flex", right: 60, top: 581, color: "#71717a", fontSize: 16 }}>mentor.thomas-johnston.com/performance</div>
    </div>
  );
}

const gmtDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Etc/UTC",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function chartBounds(values: number[]): { min: number; max: number } {
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const spread = Math.max(0.5, rawMax - rawMin);
  const rawStep = spread / 3;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / power;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power;
  const min = Math.floor((rawMin - spread * 0.08) / step) * step;
  const max = Math.ceil((rawMax + spread * 0.08) / step) * step;
  return max === min ? { min: min - 0.5, max: max + 0.5 } : { min, max };
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0].x} ${points[0].y}`;

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const third = (point.x - previous.x) / 3;
    return `${path} C${previous.x + third} ${previous.y} ${point.x - third} ${point.y} ${point.x} ${point.y}`;
  }, `M${points[0].x} ${points[0].y}`);
}

function ogPercent(value: number | null): string {
  return value == null ? "N/A" : `${Math.round(value)}%`;
}

function tickLabel(value: number): string {
  if (Math.abs(value) < 0.005) return "0R";
  const digits = Math.abs(value) < 1 ? 1 : Number.isInteger(value) ? 0 : 1;
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}R`;
}

export function performanceOpenGraphAlt(
  dataset: PerformanceDataset,
  view: PerformanceView
): string {
  return `Performance Journal year-to-date result of ${signedR(view.stats.totalR)} across ${view.stats.tradeCount} closed trade${view.stats.tradeCount === 1 ? "" : "s"}, updated ${gmtDate.format(new Date(dataset.asOf))} GMT.`;
}

export function PerformanceOpenGraphCard({
  dataset,
  view,
}: {
  dataset: PerformanceDataset;
  view: PerformanceView;
}) {
  const values = view.equity.map((point) => point.value);
  const bounds = chartBounds(values);
  const plot = { left: 60, right: 654, top: 88, bottom: 384 };
  const points = view.equity.map((point, index, items) => ({
    x: plot.left + index * (plot.right - plot.left) / Math.max(1, items.length - 1),
    y: plot.top + (bounds.max - point.value) * (plot.bottom - plot.top) / (bounds.max - bounds.min),
  }));
  const linePath = smoothPath(points);
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x} ${plot.bottom} L${points[0].x} ${plot.bottom} Z`
    : "";
  const ticks = Array.from({ length: 5 }, (_, index) => ({
    value: bounds.max - index * (bounds.max - bounds.min) / 4,
    y: plot.top + index * (plot.bottom - plot.top) / 4,
  }));
  const inception = shortDate.format(new Date(dataset.inceptionAt));
  const tradeWord = `${view.stats.tradeCount} closed trade${view.stats.tradeCount === 1 ? "" : "s"}`;
  const rootStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    width: 1200,
    height: 630,
    overflow: "hidden",
    color: "white",
    background: "radial-gradient(circle at 13% 13%, rgba(255,103,25,0.15), transparent 42%), linear-gradient(135deg, #020203 0%, #090a0d 100%)",
    fontFamily: "sans-serif",
  };

  return (
    <div style={rootStyle}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 5, background: ORANGE }} />
      <div style={{ position: "absolute", display: "flex", left: 60, top: 57, color: "#ff8b52", fontSize: 18, fontWeight: 700, letterSpacing: 3.6 }}>PERFORMANCE JOURNAL</div>

      <div style={{ position: "absolute", display: "flex", left: 60, top: 112, padding: "9px 16px", borderRadius: 999, border: "1px solid rgba(255,103,25,0.34)", background: "rgba(255,103,25,0.10)", color: "#ff9b6a", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>YEAR TO DATE</div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 180, color: "#71717a", fontSize: 14, fontWeight: 700, letterSpacing: 2.4 }}>NET RESULT</div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 207, color: "#f4f4f5", fontSize: 76, fontWeight: 650, letterSpacing: -3 }}>{signedR(view.stats.totalR)}</div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 300, color: "#a1a1aa", fontSize: 18 }}>{tradeWord} · {ogPercent(view.stats.winRate)} win rate</div>
      <div style={{ position: "absolute", left: 60, top: 354, width: 305, height: 1, background: "rgba(255,255,255,0.09)" }} />

      <div style={{ position: "absolute", display: "flex", left: 60, top: 380, color: "#71717a", fontSize: 12, fontWeight: 700, letterSpacing: 1.8 }}>EXPECTANCY</div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 404, color: "#d4d4d8", fontSize: 24, fontWeight: 600 }}>{view.stats.expectancy == null ? "N/A" : signedR(view.stats.expectancy)}</div>
      <div style={{ position: "absolute", display: "flex", left: 218, top: 380, color: "#71717a", fontSize: 12, fontWeight: 700, letterSpacing: 1.8 }}>MAX DRAWDOWN</div>
      <div style={{ position: "absolute", display: "flex", left: 218, top: 404, color: "#d4d4d8", fontSize: 24, fontWeight: 600 }}>{signedR(view.stats.maxDrawdown)}</div>

      <div style={{ position: "absolute", display: "flex", left: 60, top: 468, color: "#71717a", fontSize: 14 }}>Journal data from {inception}</div>
      <div style={{ position: "absolute", display: "flex", left: 60, top: 495, color: "#52525b", fontSize: 13 }}>Closed prop-trading results, measured in R.</div>

      <div style={{ position: "absolute", display: "flex", left: 410, top: 92, width: 730, height: 426, overflow: "hidden", borderRadius: 16, border: "1px solid rgba(255,255,255,0.11)", background: "#07090d" }}>
        <div style={{ position: "absolute", display: "flex", left: 32, top: 25, color: "#d4d4d8", fontSize: 15, fontWeight: 700, letterSpacing: 1.8 }}>CUMULATIVE R</div>
        <div style={{ position: "absolute", display: "flex", right: 31, top: 26, color: "#71717a", fontSize: 13 }}>Updated {gmtDate.format(new Date(dataset.asOf))} GMT</div>
        <svg width="730" height="426" viewBox="0 0 730 426" style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <linearGradient id="performance-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff6719" stopOpacity="0.32" />
              <stop offset="1" stopColor="#ff6719" stopOpacity="0.015" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => (
            <line key={tick.y} x1="32" x2="684" y1={tick.y} y2={tick.y} stroke="rgba(255,255,255,0.045)" />
          ))}
          {[160, 290, 420, 550].map((x) => (
            <line key={x} x1={x} x2={x} y1="64" y2="384" stroke="rgba(255,255,255,0.04)" />
          ))}
          <line x1="32" x2="684" y1={plot.top + bounds.max * (plot.bottom - plot.top) / (bounds.max - bounds.min)} y2={plot.top + bounds.max * (plot.bottom - plot.top) / (bounds.max - bounds.min)} stroke="rgba(255,255,255,0.18)" strokeDasharray="6 7" />
          {areaPath && <path d={areaPath} fill="url(#performance-area)" />}
          {linePath && <path d={linePath} fill="none" stroke="#ff6719" strokeWidth="4" strokeLinecap="round" />}
          {points.map((point, index) => (
            <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r={index === points.length - 1 ? 7 : 6} fill="#ff8b52" stroke="#07090d" strokeWidth="3" />
          ))}
        </svg>
        {ticks.slice(0, -1).map((tick) => (
          <div key={tick.y} style={{ position: "absolute", display: "flex", right: 13, top: tick.y - 8, color: Math.abs(tick.value) < 0.005 ? "#a1a1aa" : "#71717a", fontSize: 12 }}>{tickLabel(tick.value)}</div>
        ))}
        <div style={{ position: "absolute", display: "flex", left: 32, bottom: 15, color: "#52525b", fontSize: 12 }}>JOURNAL START</div>
        <div style={{ position: "absolute", display: "flex", right: 45, bottom: 15, color: "#52525b", fontSize: 12 }}>CURRENT</div>
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, top: 560, height: 1, background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", display: "flex", left: 60, top: 581, color: "#d4d4d8", fontSize: 17, fontWeight: 700 }}>THOMAS JOHNSTON</div>
      <div style={{ position: "absolute", display: "flex", right: 60, top: 581, color: "#71717a", fontSize: 16 }}>mentor.thomas-johnston.com/performance</div>
    </div>
  );
}
