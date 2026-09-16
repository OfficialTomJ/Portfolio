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

export default function TradePriceChart({ trade, candles }: { trade: PerformanceTrade; candles: TradeCandle[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !candles.length) return;

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
    series.setData(candles.map((item) => ({ ...item, time: item.time as Time })));

    const entryTime = nearestTime(candles, Math.floor(Date.parse(trade.openedAt) / 1000));
    const exitTime = nearestTime(candles, Math.floor(Date.parse(trade.closedAt) / 1000));
    const markers: SeriesMarker<Time>[] = [
      {
        time: entryTime as Time,
        position: trade.direction === "Long" ? "belowBar" : "aboveBar",
        color: "#ff6719",
        shape: trade.direction === "Long" ? "arrowUp" : "arrowDown",
        text: "Entry",
      },
      {
        time: exitTime as Time,
        position: trade.direction === "Long" ? "aboveBar" : "belowBar",
        color: "#fafafa",
        shape: "circle",
        text: "Exit",
      },
    ];
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    createSeriesMarkers(series, markers);

    series.createPriceLine({ price: trade.entryPrice, color: "rgba(255,103,25,0.7)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Entry" });
    series.createPriceLine({ price: trade.exitPrice, color: "rgba(250,250,250,0.45)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Exit" });
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [trade, candles]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 px-1 pb-3 sm:px-0">
        <span className="inline-flex items-center gap-2 rounded-md border border-[#ff6719]/20 bg-[#ff6719]/[0.06] px-2.5 py-1.5 text-[11px] text-[#ff9a67]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff6719]" />
          Entry {markerTime.format(new Date(trade.openedAt))}
        </span>
        <span className="inline-flex items-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-100" />
          Exit {markerTime.format(new Date(trade.closedAt))}
        </span>
      </div>
      <div ref={ref} className="h-[360px] w-full sm:h-[500px]" />
    </div>
  );
}
