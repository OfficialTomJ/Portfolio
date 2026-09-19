"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { signedR } from "@/lib/performance/metrics";
import type { PerformanceTrade, TradeCandle } from "@/lib/performance/types";

const GREEN = "#22c55e";
const RED = "#ef4444";

const markerTime = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

function nearestTime(candles: TradeCandle[], target: number): number {
  return candles.reduce((best, item) => Math.abs(item.time - target) < Math.abs(best - target) ? item.time : best, candles[0]?.time ?? target);
}

async function fetchMoreCandles(
  symbol: string,
  direction: "before" | "after",
  boundary: number,
  signal: AbortSignal
): Promise<TradeCandle[]> {
  const query = new URLSearchParams({
    symbol,
    direction,
    time: String(boundary),
  });
  const response = await fetch(`/api/performance/market?${query}`, { signal });
  if (!response.ok) throw new Error(`Market history returned ${response.status}`);
  const payload = (await response.json()) as { candles?: TradeCandle[] };
  return Array.isArray(payload.candles) ? payload.candles : [];
}

export default function TradePriceChart({ trade, candles }: { trade: PerformanceTrade; candles: TradeCandle[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const activeWindowRef = useRef<HTMLDivElement>(null);
  const beforeWindowRef = useRef<HTMLDivElement>(null);
  const afterWindowRef = useRef<HTMLDivElement>(null);
  const profitZoneRef = useRef<HTMLDivElement>(null);
  const drawdownZoneRef = useRef<HTMLDivElement>(null);
  const entryLineRef = useRef<HTMLDivElement>(null);
  const directionColor = trade.direction === "Long" ? GREEN : RED;
  const resultColor = trade.resultR >= 0 ? GREEN : RED;
  const result = signedR(trade.resultR);

  useEffect(() => {
    const element = ref.current;
    if (!element || !candles.length) return;
    let allCandles = [...candles].sort((a, b) => a.time - b.time);
    let disposed = false;
    const loading = { before: false, after: false };
    const exhausted = { before: false, after: false };
    const controllers = new Set<AbortController>();
    element.dataset.candleCount = String(allCandles.length);

    const precision = trade.entryPrice < 100 ? 3 : trade.entryPrice < 1000 ? 2 : trade.entryPrice < 10_000 ? 1 : 0;
    const chart = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "inherit",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.09)", scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: "rgba(255,255,255,0.09)", rightOffset: 4, timeVisible: true, secondsVisible: false },
      localization: { priceFormatter: (value: number) => value.toLocaleString('en-AU', { minimumFractionDigits: precision, maximumFractionDigits: precision }) },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: GREEN,
      downColor: RED,
      wickUpColor: GREEN,
      wickDownColor: RED,
      borderVisible: false,
      priceLineVisible: false,
    });
    series.setData(allCandles.map((item) => ({ ...item, time: item.time as Time })));

    const entryTime = nearestTime(candles, Math.floor(Date.parse(trade.openedAt) / 1000));
    const exitTime = nearestTime(candles, Math.floor(Date.parse(trade.closedAt) / 1000));
    const compact = element.clientWidth < 640;
    const markers: SeriesMarker<Time>[] = [
      {
        time: entryTime as Time,
        position: trade.direction === "Long" ? "belowBar" : "aboveBar",
        color: directionColor,
        shape: trade.direction === "Long" ? "arrowUp" : "arrowDown",
        text: compact ? "ENTRY" : `${trade.direction.toUpperCase()} ENTRY`,
      },
      {
        time: exitTime as Time,
        position: trade.direction === "Long" ? "aboveBar" : "belowBar",
        color: resultColor,
        shape: "circle",
        text: `EXIT ${result}`,
      },
    ];
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    createSeriesMarkers(series, markers);

    series.createPriceLine({
      price: trade.entryPrice,
      color: directionColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lineVisible: false,
      axisLabelVisible: true,
      axisLabelColor: directionColor,
      axisLabelTextColor: "#050505",
      title: "Entry",
    });
    series.createPriceLine({
      price: trade.exitPrice,
      color: resultColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lineVisible: false,
      axisLabelVisible: true,
      axisLabelColor: resultColor,
      axisLabelTextColor: "#050505",
      title: "Exit",
    });
    chart.timeScale().fitContent();

    const setBox = (
      node: HTMLDivElement | null,
      left: number,
      top: number,
      width: number,
      height: number
    ) => {
      if (!node) return;
      node.style.left = `${Math.round(left)}px`;
      node.style.top = `${Math.round(top)}px`;
      node.style.width = `${Math.max(0, Math.round(width))}px`;
      node.style.height = `${Math.max(0, Math.round(height))}px`;
      node.style.opacity = "1";
    };

    let frame = 0;
    const updateOverlay = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const entryX = chart.timeScale().timeToCoordinate(entryTime as Time);
        const exitX = chart.timeScale().timeToCoordinate(exitTime as Time);
        const entryY = series.priceToCoordinate(trade.entryPrice);
        const paneHeight = chart.panes()[0]?.getHeight() ?? 0;
        const paneWidth = chart.timeScale().width();
        if (entryX === null || exitX === null || entryY === null || paneHeight <= 0 || paneWidth <= 0) return;

        const padding = Math.max(4, chart.timeScale().options().barSpacing / 2);
        const left = Math.max(0, Math.min(entryX, exitX) - padding);
        const right = Math.min(paneWidth, Math.max(entryX, exitX) + padding);
        const width = Math.max(2, right - left);
        const split = Math.max(0, Math.min(paneHeight, entryY));

        setBox(beforeWindowRef.current, 0, 0, left, paneHeight);
        setBox(afterWindowRef.current, right, 0, paneWidth - right, paneHeight);
        setBox(activeWindowRef.current, left, 0, width, paneHeight);
        setBox(entryLineRef.current, 0, split, width, 1);

        if (trade.direction === "Long") {
          setBox(profitZoneRef.current, 0, 0, width, split);
          setBox(drawdownZoneRef.current, 0, split, width, paneHeight - split);
        } else {
          setBox(drawdownZoneRef.current, 0, 0, width, split);
          setBox(profitZoneRef.current, 0, split, width, paneHeight - split);
        }
      });
    };

    const resizeObserver = new ResizeObserver(updateOverlay);
    resizeObserver.observe(element);

    const loadHistory = async (direction: "before" | "after") => {
      if (disposed || loading[direction] || exhausted[direction]) return;
      const boundary = direction === "before"
        ? allCandles[0]?.time
        : allCandles[allCandles.length - 1]?.time;
      if (!boundary) return;

      loading[direction] = true;
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const previousVisibleRange = chart.timeScale().getVisibleRange();
        const incoming = await fetchMoreCandles(trade.symbol, direction, boundary, controller.signal);
        if (disposed) return;
        const byTime = new Map(allCandles.map((item) => [item.time, item]));
        for (const item of incoming) byTime.set(item.time, item);
        const merged = [...byTime.values()].sort((a, b) => a.time - b.time);
        if (merged.length === allCandles.length || incoming.length < 200) exhausted[direction] = true;
        if (merged.length !== allCandles.length) {
          allCandles = merged;
          element.dataset.candleCount = String(allCandles.length);
          series.setData(allCandles.map((item) => ({ ...item, time: item.time as Time })));
          if (previousVisibleRange) chart.timeScale().setVisibleRange(previousVisibleRange);
          updateOverlay();
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("[performance/chart-history]", error);
        }
      } finally {
        controllers.delete(controller);
        loading[direction] = false;
      }
    };

    const handleVisibleRange = (range: { from: number; to: number } | null) => {
      updateOverlay();
      if (!range) return;
      if (range.from < 12) void loadHistory("before");
      if (range.to > allCandles.length - 12) void loadHistory("after");
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRange);
    updateOverlay();

    return () => {
      disposed = true;
      for (const controller of controllers) controller.abort();
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRange);
      chart.remove();
      chartRef.current = null;
    };
  }, [trade, candles, directionColor, result, resultColor]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 px-1 pb-3 sm:px-0">
        <span
          className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px]"
          style={{ borderColor: `${directionColor}59`, backgroundColor: `${directionColor}1a`, color: directionColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: directionColor }} />
          {trade.direction.toUpperCase()} {trade.direction === "Long" ? "↑" : "↓"} · PROFIT {trade.direction === "Long" ? "ABOVE" : "BELOW"} ENTRY
        </span>
        <span className="inline-flex items-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-300">
          Entry {markerTime.format(new Date(trade.openedAt))}
        </span>
        <span
          className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px]"
          style={{ borderColor: `${resultColor}59`, backgroundColor: `${resultColor}12`, color: resultColor }}
        >
          Exit {result} · {markerTime.format(new Date(trade.closedAt))}
        </span>
      </div>
      <div className="relative h-[360px] w-full overflow-hidden sm:h-[500px]">
        <div
          ref={ref}
          data-performance-chart
          role="img"
          aria-label={`Interactive ${trade.symbol} one hour price chart. Drag or scroll horizontally to explore more history.`}
          className="absolute inset-0"
        />
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
          <div ref={beforeWindowRef} className="absolute bg-black/25 opacity-0" />
          <div ref={afterWindowRef} className="absolute bg-black/25 opacity-0" />
          <div
            ref={activeWindowRef}
            className="absolute overflow-hidden border-x border-[#ff6719]/45 opacity-0"
          >
            <div ref={profitZoneRef} className="absolute bg-[#22c55e]/[0.075] opacity-0">
              <span className="absolute right-2 top-2 hidden text-[9px] font-semibold uppercase tracking-[0.14em] text-[#22c55e]/70 sm:block">Profit</span>
            </div>
            <div ref={drawdownZoneRef} className="absolute bg-[#ef4444]/[0.075] opacity-0">
              <span className="absolute right-2 bottom-2 hidden text-[9px] font-semibold uppercase tracking-[0.14em] text-[#ef4444]/70 sm:block">Drawdown</span>
            </div>
            <div
              ref={entryLineRef}
              className="absolute border-t border-dashed opacity-0"
              style={{ borderColor: `${directionColor}B3` }}
            />
            <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] overflow-hidden whitespace-nowrap rounded border border-[#ff6719]/25 bg-black/70 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#ff8b52]">
              {trade.direction} active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
