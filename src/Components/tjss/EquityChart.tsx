"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { EquityPoint } from "@/lib/tjss/types";

export default function EquityChart({ equity }: { equity: EquityPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.09)" },
      timeScale: { borderColor: "rgba(255,255,255,0.09)" },
    });
    chartRef.current = chart;

    const strat = chart.addSeries(LineSeries, {
      color: "#ff6719",
      lineWidth: 2,
      title: "TJSS",
    });
    strat.setData(equity.map((e) => ({ time: e.time as Time, value: e.equity })));

    const bh = chart.addSeries(LineSeries, {
      color: "#71717a",
      lineWidth: 1,
      title: "Buy & Hold",
    });
    bh.setData(equity.map((e) => ({ time: e.time as Time, value: e.buyHold })));

    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [equity]);

  return <div ref={ref} className="h-[240px] sm:h-[300px] w-full" />;
}
