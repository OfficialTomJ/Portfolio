"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type SeriesMarker,
  type Time,
  type WhitespaceData,
} from "lightweight-charts";
import { signedR } from "@/lib/performance/metrics";
import type {
  MarketCandles,
  PerformanceTrade,
  TradeCandle,
  TradeCandleInterval,
  TradeCandleSource,
} from "@/lib/performance/types";

const GREEN = "#22c55e";
const RED = "#ef4444";
const INTERVAL_SECONDS: Record<TradeCandleInterval, number> = {
  "1h": 3_600,
  "4h": 4 * 3_600,
  "1d": 24 * 3_600,
};
const INTERVAL_LABELS: Record<TradeCandleInterval, string> = {
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};
const LEFT_CONTEXT_BARS = 20;
const RIGHT_CONTEXT_BARS = 5;
const DATA_BUFFER_BARS = 24;

const markerTime = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

function nearestTime(candles: TradeCandle[], target: number): number {
  return candles.reduce((best, item) => Math.abs(item.time - target) < Math.abs(best - target) ? item.time : best, candles[0]?.time ?? target);
}

function withRightPadding(
  candles: TradeCandle[],
  exitTime: number,
  intervalSeconds: number
): Array<CandlestickData<Time> | WhitespaceData<Time>> {
  const data: Array<CandlestickData<Time> | WhitespaceData<Time>> = candles.map((item) => ({
    ...item,
    time: item.time as Time,
  }));
  const exitIndex = candles.findIndex((candle) => candle.time === exitTime);
  const barsAfterExit = exitIndex >= 0 ? candles.length - 1 - exitIndex : 0;
  const paddingBars = Math.max(0, RIGHT_CONTEXT_BARS - barsAfterExit);
  const lastTime = candles[candles.length - 1]?.time;

  if (lastTime) {
    for (let index = 1; index <= paddingBars; index += 1) {
      data.push({ time: (lastTime + index * intervalSeconds) as Time });
    }
  }

  return data;
}

async function fetchMoreCandles(
  symbol: string,
  interval: TradeCandleInterval,
  source: TradeCandleSource,
  direction: "before" | "after",
  boundary: number,
  signal: AbortSignal
): Promise<TradeCandle[]> {
  const query = new URLSearchParams({
    symbol,
    interval,
    source,
    direction,
    time: String(boundary),
  });
  const response = await fetch(`/api/performance/market?${query}`, { signal });
  if (!response.ok) throw new Error(`Market history returned ${response.status}`);
  const payload = (await response.json()) as Partial<MarketCandles>;
  if (payload.source !== source) throw new Error("Market source changed during chart history");
  return Array.isArray(payload.candles) ? payload.candles : [];
}

async function fetchCandleWindow(
  trade: PerformanceTrade,
  interval: TradeCandleInterval,
  source: TradeCandleSource,
  signal: AbortSignal
): Promise<TradeCandle[]> {
  const intervalSeconds = INTERVAL_SECONDS[interval];
  const query = new URLSearchParams({
    symbol: trade.symbol,
    interval,
    source,
    direction: "window",
    start: String(Math.floor(Date.parse(trade.openedAt) / 1000) - DATA_BUFFER_BARS * intervalSeconds),
    end: String(Math.ceil(Date.parse(trade.closedAt) / 1000) + DATA_BUFFER_BARS * intervalSeconds),
  });
  const response = await fetch(`/api/performance/market?${query}`, { signal });
  if (!response.ok) throw new Error(`Market window returned ${response.status}`);
  const payload = (await response.json()) as Partial<MarketCandles>;
  if (payload.source !== source) throw new Error("Market source changed during timeframe switch");
  return Array.isArray(payload.candles) ? payload.candles : [];
}

export default function TradePriceChart({
  trade,
  candles,
  source,
  initialInterval = "4h",
}: {
  trade: PerformanceTrade;
  candles: TradeCandle[];
  source: TradeCandleSource;
  initialInterval?: TradeCandleInterval;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const intervalRequestRef = useRef<AbortController | null>(null);
  const [interval, setInterval] = useState<TradeCandleInterval>(initialInterval);
  const [chartCandles, setChartCandles] = useState(candles);
  const [loadingInterval, setLoadingInterval] = useState<TradeCandleInterval | null>(null);
  const activeWindowRef = useRef<HTMLDivElement>(null);
  const beforeWindowRef = useRef<HTMLDivElement>(null);
  const afterWindowRef = useRef<HTMLDivElement>(null);
  const profitZoneRef = useRef<HTMLDivElement>(null);
  const drawdownZoneRef = useRef<HTMLDivElement>(null);
  const entryLineRef = useRef<HTMLDivElement>(null);
  const directionColor = trade.direction === "Long" ? GREEN : RED;
  const resultColor = trade.resultR >= 0 ? GREEN : RED;
  const result = signedR(trade.resultR);

  const changeInterval = async (nextInterval: TradeCandleInterval) => {
    if (nextInterval === interval || loadingInterval === nextInterval) return;
    intervalRequestRef.current?.abort();
    const controller = new AbortController();
    intervalRequestRef.current = controller;
    setLoadingInterval(nextInterval);
    try {
      const incoming = await fetchCandleWindow(trade, nextInterval, source, controller.signal);
      if (!incoming.length) throw new Error("No candles returned for this timeframe");
      setChartCandles(incoming);
      setInterval(nextInterval);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("[performance/chart-window]", error);
      }
    } finally {
      if (intervalRequestRef.current === controller) {
        intervalRequestRef.current = null;
        setLoadingInterval(null);
      }
    }
  };

  useEffect(() => () => intervalRequestRef.current?.abort(), []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !chartCandles.length) return;
    const sortedCandles = [...chartCandles].sort((a, b) => a.time - b.time);
    const entryTime = nearestTime(sortedCandles, Math.floor(Date.parse(trade.openedAt) / 1000));
    const exitTime = nearestTime(sortedCandles, Math.floor(Date.parse(trade.closedAt) / 1000));
    const rawEntryIndex = Math.max(0, sortedCandles.findIndex((candle) => candle.time === entryTime));
    const matchedRawExitIndex = sortedCandles.findIndex((candle) => candle.time === exitTime);
    const rawExitIndex = matchedRawExitIndex >= 0 ? matchedRawExitIndex : sortedCandles.length - 1;
    const intervalSeconds = INTERVAL_SECONDS[interval];
    let allCandles = sortedCandles.slice(
      Math.max(0, rawEntryIndex - LEFT_CONTEXT_BARS),
      Math.min(sortedCandles.length, rawExitIndex + RIGHT_CONTEXT_BARS + 1)
    );
    let disposed = false;
    const loading = { before: false, after: false };
    const exhausted = { before: false, after: false };
    const controllers = new Set<AbortController>();
    element.dataset.candleCount = String(allCandles.length);

    const precision = trade.entryPrice < 100 ? 3 : trade.entryPrice < 1000 ? 2 : trade.entryPrice < 10_000 ? 1 : 0;
    const compact = element.clientWidth < 640;
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
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.09)",
        minimumWidth: compact ? 86 : 92,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.09)",
        rightOffset: 0,
        rightOffsetPixels: compact ? 24 : 40,
        lockVisibleTimeRangeOnResize: true,
        timeVisible: true,
        secondsVisible: false,
      },
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
    series.setData(withRightPadding(allCandles, exitTime, intervalSeconds));

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
        const incoming = await fetchMoreCandles(
          trade.symbol,
          interval,
          source,
          direction,
          boundary,
          controller.signal
        );
        if (disposed) return;
        const byTime = new Map(allCandles.map((item) => [item.time, item]));
        for (const item of incoming) byTime.set(item.time, item);
        const merged = [...byTime.values()].sort((a, b) => a.time - b.time);
        if (merged.length === allCandles.length || incoming.length < 200) exhausted[direction] = true;
        if (merged.length !== allCandles.length) {
          allCandles = merged;
          element.dataset.candleCount = String(allCandles.length);
          series.setData(withRightPadding(allCandles, exitTime, intervalSeconds));
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
      if (!range || !initialViewportReady) return;
      if (range.from < 6) void loadHistory("before");
      if (range.to > allCandles.length - 6) void loadHistory("after");
    };

    let initialViewportReady = false;
    let historySubscriptionActive = false;
    const historySubscriptionFrame = requestAnimationFrame(() => {
      if (disposed) return;
      initialViewportReady = true;
      chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRange);
      historySubscriptionActive = true;
    });
    updateOverlay();

    return () => {
      disposed = true;
      for (const controller of controllers) controller.abort();
      cancelAnimationFrame(historySubscriptionFrame);
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      if (historySubscriptionActive) chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRange);
      chart.remove();
      chartRef.current = null;
    };
  }, [trade, chartCandles, interval, source, directionColor, result, resultColor]);

  return (
    <div>
      <div className="flex flex-col gap-3 px-1 pb-3 sm:flex-row sm:items-start sm:justify-between sm:px-0">
        <div className="flex min-w-0 flex-wrap gap-2">
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
        <div className="inline-flex w-fit shrink-0 rounded-lg border border-white/[0.09] bg-black/60 p-1" role="group" aria-label="Candle timeframe">
          {(Object.keys(INTERVAL_LABELS) as TradeCandleInterval[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={interval === item}
              disabled={loadingInterval !== null}
              onClick={() => void changeInterval(item)}
              className={`min-w-11 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${interval === item ? "bg-[#ff6719]/20 text-[#ff9a67]" : "text-zinc-500 hover:text-white"}`}
            >
              {INTERVAL_LABELS[item]}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[360px] w-full overflow-hidden sm:h-[500px]">
        <div
          ref={ref}
          data-performance-chart
          role="img"
          aria-label={`Interactive ${trade.symbol} ${INTERVAL_LABELS[interval]} price chart. Drag or scroll horizontally to explore more history.`}
          className="absolute inset-0"
        />
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
          <div ref={beforeWindowRef} className="absolute bg-black/25 opacity-0" />
          <div ref={afterWindowRef} className="absolute bg-black/25 opacity-0" />
          <div
            ref={activeWindowRef}
            className="absolute overflow-hidden border-x border-[#ff6719]/45 opacity-0"
          >
            <div ref={profitZoneRef} className="absolute bg-[#22c55e]/[0.075] opacity-0" />
            <div ref={drawdownZoneRef} className="absolute bg-[#ef4444]/[0.075] opacity-0" />
            <div
              ref={entryLineRef}
              className="absolute border-t border-dashed opacity-0"
              style={{ borderColor: `${directionColor}B3` }}
            />
            <span className="absolute left-2 top-2 hidden max-w-[calc(100%-1rem)] overflow-hidden whitespace-nowrap rounded border border-[#ff6719]/25 bg-black/70 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#ff8b52] sm:block">
              {trade.direction} active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
