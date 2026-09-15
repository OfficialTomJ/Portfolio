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
        textColor: "#71717a",
        fontFamily: "inherit",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.055)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.16, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 2,
        timeVisible: false,
      },
      localization: { priceFormatter: (value: number) => `${value.toFixed(1)}R` },
    });
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#4f8cff",
      topColor: "rgba(79,140,255,0.30)",
      bottomColor: "rgba(79,140,255,0.015)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerBorderColor: "#05070b",
      crosshairMarkerBackgroundColor: "#8ab4ff",
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
