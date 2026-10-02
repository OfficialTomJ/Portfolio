"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  LineStyle,
  LineType,
  LineSeries,
  type ISeriesApi,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { EquityPoint } from "@/lib/performance/types";

export default function PerformanceEquityChart({ points, comparisonPoints }: { points: EquityPoint[]; comparisonPoints?: EquityPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const actualRef = useRef<ISeriesApi<"Area"> | null>(null);
  const expectedRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [showActual, setShowActual] = useState(true);
  const [showExpected, setShowExpected] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

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
        scaleMargins: { top: 0.16, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.09)",
        rightOffset: 0.4,
        timeVisible: false,
      },
      localization: { priceFormatter: (value: number) => `${value.toFixed(1)}R` },
    });
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#ff6719",
      lineType: LineType.Curved,
      topColor: "rgba(255,103,25,0.28)",
      bottomColor: "rgba(255,103,25,0.012)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerBorderColor: "#05070b",
      crosshairMarkerBackgroundColor: "#ff8b52",
    });
    series.setData(points.map((point) => ({ time: point.time as Time, value: point.value })));
    actualRef.current = series;
    if (comparisonPoints) {
      const expected = chart.addSeries(LineSeries, {
        color: "#d4d4d8", lineWidth: 2, lineType: LineType.Curved, lineStyle: LineStyle.Dashed,
        priceLineVisible: false, lastValueVisible: true,
      });
      expected.setData(comparisonPoints.map((point) => ({ time: point.time as Time, value: point.value })));
      expectedRef.current = expected;
    }
    series.createPriceLine({
      price: 0,
      color: "rgba(255,255,255,0.18)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    });
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      actualRef.current = null;
      expectedRef.current = null;
    };
  }, [points, comparisonPoints]);

  useEffect(() => {
    actualRef.current?.applyOptions({ visible: showActual });
    expectedRef.current?.applyOptions({ visible: showExpected });
  }, [showActual, showExpected, points, comparisonPoints]);

  return <div>
    {comparisonPoints && <div className="mb-4 flex flex-wrap gap-2">
      <button type="button" aria-pressed={showActual} onClick={() => setShowActual(!showActual)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${showActual ? "border-[#ff6719]/40 text-[#ffad83]" : "border-white/10 text-zinc-500"}`}><span className="h-0.5 w-5 bg-[#ff6719]" />Actual R</button>
      <button type="button" aria-pressed={showExpected} onClick={() => setShowExpected(!showExpected)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${showExpected ? "border-white/30 text-zinc-200" : "border-white/10 text-zinc-500"}`}><span className="w-5 border-t-2 border-dashed border-zinc-300" />ASR Expected R</button>
    </div>}
    <div className="relative"><div ref={ref} className="h-[270px] w-full sm:h-[330px]" />{comparisonPoints && !showActual && !showExpected && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-zinc-500">Select a curve to show it.</p>}</div>
  </div>;
}
