"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  LineStyle,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { EquityPoint } from "@/lib/performance/types";

export default function PerformanceEquityChart({ points }: { points: EquityPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

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
        rightOffset: 2,
        timeVisible: false,
      },
      localization: { priceFormatter: (value: number) => `${value.toFixed(1)}R` },
    });
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#ff6719",
      topColor: "rgba(255,103,25,0.28)",
      bottomColor: "rgba(255,103,25,0.012)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerBorderColor: "#05070b",
      crosshairMarkerBackgroundColor: "#ff8b52",
    });
    series.setData(points.map((point) => ({ time: point.time as Time, value: point.value })));
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
    };
  }, [points]);

  return <div ref={ref} className="h-[270px] w-full sm:h-[330px]" />;
}
