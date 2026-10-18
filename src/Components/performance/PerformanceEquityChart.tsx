"use client";

import { useEffect, useId, useRef, useState } from "react";
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
import type { EquityPoint, PublicRiskEvent } from "@/lib/performance/types";
import { riskEventTimeline } from "@/lib/performance/risk-events";

const eventDate = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const NO_EVENTS: PublicRiskEvent[] = [];

export default function PerformanceEquityChart({ points, comparisonPoints, riskEvents = NO_EVENTS, riskContext }: {
  points: EquityPoint[]; comparisonPoints?: EquityPoint[]; riskEvents?: PublicRiskEvent[]; riskContext?: PublicRiskEvent;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const actualRef = useRef<ISeriesApi<"Area"> | null>(null);
  const expectedRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [showActual, setShowActual] = useState(true);
  const [showExpected, setShowExpected] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const markers = useRef(new Map<string, HTMLDivElement>());
  const detailsId = useId();
  const activeEvent = riskEvents.find(e => e.id === selectedEvent);

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
    series.setData(riskEventTimeline(points, riskEvents).map((point) => ({ time: point.time as Time, value: point.value })));
    actualRef.current = series;
    if (comparisonPoints) {
      const expected = chart.addSeries(LineSeries, {
        color: "#d4d4d8", lineWidth: 2, lineType: LineType.Curved, lineStyle: LineStyle.Dashed,
        priceLineVisible: false, lastValueVisible: true,
      });
      expected.setData(riskEventTimeline(comparisonPoints, riskEvents).map((point) => ({ time: point.time as Time, value: point.value })));
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
    const positionMarkers = () => {
      const width = chart.timeScale().width();
      for (const event of riskEvents) {
        const marker = markers.current.get(event.id);
        if (!marker) continue;
        const x = chart.timeScale().timeToCoordinate(Math.floor(Date.parse(event.effectiveAt) / 1000) as Time);
        marker.hidden = x === null || x < 0 || x > width;
        if (x !== null) {
          marker.style.left = `${x}px`;
          const button = marker.querySelector("button");
          if (button) button.style.transform = x < 70 ? "translateX(0)" : x > width - 70 ? "translateX(-100%)" : "translateX(-50%)";
        }
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(positionMarkers);
    chart.timeScale().subscribeSizeChange(positionMarkers);
    const frame = requestAnimationFrame(positionMarkers);

    return () => {
      cancelAnimationFrame(frame);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(positionMarkers);
      chart.timeScale().unsubscribeSizeChange(positionMarkers);
      chart.remove();
      chartRef.current = null;
      actualRef.current = null;
      expectedRef.current = null;
    };
  }, [points, comparisonPoints, riskEvents]);

  useEffect(() => {
    actualRef.current?.applyOptions({ visible: showActual });
    expectedRef.current?.applyOptions({ visible: showExpected });
  }, [showActual, showExpected, points, comparisonPoints]);

  return <div>
    {comparisonPoints && <div className="mb-4 flex flex-wrap gap-2">
      <button type="button" aria-pressed={showActual} onClick={() => setShowActual(!showActual)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${showActual ? "border-[#ff6719]/40 text-[#ffad83]" : "border-white/10 text-zinc-500"}`}><span className="h-0.5 w-5 bg-[#ff6719]" />Actual R</button>
      <button type="button" aria-pressed={showExpected} onClick={() => setShowExpected(!showExpected)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${showExpected ? "border-white/30 text-zinc-200" : "border-white/10 text-zinc-500"}`}><span className="w-5 border-t-2 border-dashed border-zinc-300" />ASR Expected R</button>
    </div>}
    <div className="relative"><div ref={ref} className="h-[270px] w-full sm:h-[330px]" />
      {riskEvents.map(event => <div key={event.id} ref={node => { if (node) markers.current.set(event.id, node); else markers.current.delete(event.id); }} hidden data-risk-event={event.id} className="pointer-events-none absolute bottom-8 top-0 z-10 w-px border-l border-dashed border-zinc-300/70">
        <button type="button" aria-expanded={activeEvent?.id === event.id} aria-controls={activeEvent ? detailsId : undefined} onKeyDown={e => { if (e.key === "Escape") setSelectedEvent(null); }} aria-label={`${event.title}, ${eventDate.format(new Date(event.effectiveAt))} GMT`} onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)} className="pointer-events-auto absolute top-1 whitespace-nowrap rounded-md border border-zinc-500 bg-[#11151b] px-2 py-2 text-[11px] text-zinc-100 shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">{event.title}</button>
      </div>)}
      {comparisonPoints && !showActual && !showExpected && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-zinc-500">Select a curve to show it.</p>}</div>
    {activeEvent && <div id={detailsId} role="region" aria-label="Risk change details" onKeyDown={e => { if (e.key === "Escape") { setSelectedEvent(null); markers.current.get(activeEvent.id)?.querySelector("button")?.focus(); } }} className="mt-3 rounded-lg border border-white/15 bg-white/[0.03] p-3 text-xs leading-5 text-zinc-300">
      <div className="flex items-start justify-between gap-3"><p className="font-medium text-zinc-100">{activeEvent.title} · {eventDate.format(new Date(activeEvent.effectiveAt))} GMT</p><button type="button" aria-label="Close risk change details" onClick={() => { setSelectedEvent(null); markers.current.get(activeEvent.id)?.querySelector("button")?.focus(); }} className="px-2 text-zinc-300">Close</button></div>
      <p className="mt-1">{activeEvent.description}</p>
    </div>}
    {riskContext && <p className="mt-3 text-xs leading-5 text-zinc-400" data-risk-disclosure>Risk reduced from {eventDate.format(new Date(riskContext.effectiveAt))} GMT. R is normalised to the risk unit at entry; cumulative R is not dollar or percentage account return.</p>}
  </div>;
}
