"use client";
import { type PointerEvent, useEffect, useId, useRef, useState } from "react";
import type { PublicSpotActivity, SpotPoint } from "@/lib/spot/types";
import { dateLabel, signedPct, spotColour } from "@/lib/spot/view";
import AssetLogo from "./AssetLogo";
import { chartDateTicks, smoothChartPath, splitChartPathAtY } from "@/lib/spot/chart-geometry";

export function SpotPerformanceChart({ points, activity, timeZone = "UTC", tradeLabel = "Show trades", costLabel = "Net of recorded fees", comparison = "benchmark", quoteCurrency = "USD", showOptions = true }: { points: SpotPoint[]; activity: Pick<PublicSpotActivity, "id" | "at" | "kind">[]; timeZone?: string; tradeLabel?: string; costLabel?: string; comparison?: "benchmark" | "usd" | "usd-comparison"; quoteCurrency?: string; showOptions?: boolean }) {
  const id = useId().replace(/:/g, ""), [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null), [size, setSize] = useState({ width: 1080, height: 310 });
  const [portfolioVisible, setPortfolioVisible] = useState(true), [btcVisible, setBtcVisible] = useState(true), [relative, setRelative] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  const hasPoints = points.length >= 2;
  const chartDate = (at: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(at));
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !hasPoints) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.max(1, width), height: Math.max(1, height) });
    });
    observer.observe(svg); return () => observer.disconnect();
  }, [hasPoints]);
  if (points.length < 2) return <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-zinc-500">Choose a period with at least two valuation points.</div>;
  const W = size.width, H = size.height, left = 9, right = comparison === "benchmark" ? 51 : 72, top = 22, bottom = 35, width = Math.max(1, W - left - right), height = Math.max(1, H - top - bottom);
  const start = points[0], portfolio = points.map(p => (p.portfolioIndex / start.portfolioIndex - 1) * 100), btc = points.map(p => (p.btcIndex / start.btcIndex - 1) * 100);
  const relativeValues = portfolio.map((p, i) => ((1 + p / 100) / (1 + btc[i] / 100) - 1) * 100);
  const denominated = comparison !== "benchmark";
  const primaryValues = !denominated && relative ? relativeValues : portfolio;
  const secondaryValues = btc;
  const primaryVisible = !denominated && relative ? true : portfolioVisible;
  const hasBenchmark = comparison !== "usd";
  const secondaryVisible = hasBenchmark && (denominated || !relative) && btcVisible;
  const primaryColour = comparison === "usd" ? "#54d6b2" : "#ff8b52";
  const returnColour = (value: number) => comparison === "usd" && value < 0 ? "#fb7185" : primaryColour;
  const primaryLabel = denominated ? `Your portfolio (${quoteCurrency})` : relative ? "BTC-relative" : "Portfolio";
  const benchmarkLabel = denominated ? `100% Bitcoin hold (${quoteCurrency})` : "BTC";
  const values = [...(primaryVisible ? primaryValues : []), ...(secondaryVisible ? secondaryValues : [])];
  const low = Math.min(0, ...values), high = Math.max(1, ...values), padding = Math.max(3, (high - low) * .16), min = low - padding, max = high + padding;
  const times = points.map(p => Date.parse(p.at)), timeSpan = times.at(-1)! - times[0];
  const x = (i: number) => left + (times[i] - times[0]) / Math.max(1, timeSpan) * width;
  const y = (value: number) => top + (max - value) / (max - min) * height;
  const line = (series: number[]) => smoothChartPath(series.map((v, i) => ({ x: x(i), y: y(v) })));
  const portfolioPath = line(primaryValues), secondaryPath = line(secondaryValues);
  const usdStrokePaths = comparison === "usd" ? splitChartPathAtY(primaryValues.map((v, i) => ({ x: x(i), y: y(v) })), y(0)) : null;
  const dateTicks = chartDateTicks(times[0], times.at(-1)!, width);
  const axisYear = new Intl.DateTimeFormat("en-AU", { year: "numeric", timeZone });
  const multipleYears = axisYear.format(new Date(times[0])) !== axisYear.format(new Date(times.at(-1)!));
  const active = hover === null ? points.length - 1 : Math.min(hover, points.length - 1);
  const inspectedValue = primaryVisible ? primaryValues[active] : secondaryValues[active];
  const inspectedColour = primaryVisible ? returnColour(inspectedValue) : "#a1a1aa";
  const guideColour = comparison === "usd" ? inspectedValue < 0 ? "#fb7185" : "#54d6b2" : inspectedColour;
  const guideLabelY = Math.max(top, Math.min(H - bottom - 22, y(inspectedValue) - 11));
  const inspectedDate = chartDate(points[active].at);
  const dateGuideWidth = Math.min(width, inspectedDate.length * 6 + 20);
  const dateGuideX = Math.max(left, Math.min(W - right - dateGuideWidth, x(active) - dateGuideWidth / 2));
  const markers = activity.filter(a => ["buy", "sell"].includes(a.kind)).map(a => ({ event: a, i: points.findLastIndex(p => p.at === a.at) })).filter(a => a.i >= 0);
  const inspect = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect(), target = ((event.clientX - bounds.left) / bounds.width * W - left) / width;
    const time = times[0] + Math.max(0, Math.min(1, target)) * timeSpan;
    let nearest = 0;
    times.forEach((t, i) => { if (Math.abs(t - time) < Math.abs(times[nearest] - time)) nearest = i; });
    setHover(nearest);
  };
  return <div>
    <div className="flex min-h-11 items-center justify-between gap-2 px-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 text-[11px]">
        <button type="button" aria-label={denominated ? "Show portfolio return" : "Show portfolio curve"} aria-pressed={primaryVisible} onClick={() => { if (!denominated) setRelative(false); setPortfolioVisible(!portfolioVisible); }} className={`inline-flex min-h-11 items-center gap-1.5 ${primaryVisible ? "text-zinc-300" : "text-zinc-600"}`}><span className="h-0.5 w-3" style={{ backgroundColor: returnColour(primaryValues[active]) }}/>{primaryLabel}{hover !== null && <span className="ml-1 tabular-nums" style={{ color: returnColour(primaryValues[active]) }}>{signedPct(primaryValues[active])}</span>}</button>
        {hasBenchmark && (denominated || !relative) && <button type="button" aria-label={denominated ? "Show Bitcoin benchmark" : "Show BTC curve"} aria-pressed={secondaryVisible} title={`Return from holding 100% Bitcoin throughout the selected period, measured in ${quoteCurrency}.`} onClick={() => setBtcVisible(!btcVisible)} className={`inline-flex min-h-11 items-center gap-1.5 ${secondaryVisible ? "text-zinc-300" : "text-zinc-600"}`}><span className="w-3 border-t border-dashed border-zinc-400"/>{benchmarkLabel}{hover !== null && <span className="ml-1 tabular-nums text-zinc-300">{signedPct(secondaryValues[active])}</span>}</button>}
      </div>
      {showOptions && <details className="relative z-10 shrink-0">
        <summary aria-label="Chart options" className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-lg text-lg tracking-widest text-zinc-500 hover:bg-white/[.04] hover:text-zinc-200">···</summary>
        <div className="absolute right-0 top-full w-52 rounded-xl border border-white/15 bg-[#151518] p-2 shadow-xl">
          {!denominated && <label className="flex min-h-11 cursor-pointer items-center gap-3 px-2 text-xs text-zinc-300"><input type="checkbox" className="accent-[#ff8b52]" checked={relative} onChange={e => setRelative(e.target.checked)}/>BTC-relative view</label>}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-2 text-xs text-zinc-300"><input type="checkbox" className="accent-[#ff8b52]" checked={showTrades} onChange={e => setShowTrades(e.target.checked)}/>{tradeLabel}</label>
        </div>
      </details>}
    </div>
    <div className="relative px-2 pb-2 sm:px-4" tabIndex={0} role="group" aria-label="Performance chart. Use left and right arrow keys to inspect dates."
      onKeyDown={event => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); setHover(Math.max(0, Math.min(points.length - 1, active + (event.key === "ArrowRight" ? 1 : -1)))); } }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-[232px] w-full touch-pan-y min-[380px]:h-[254px] sm:h-[clamp(260px,38svh,380px)]" preserveAspectRatio="xMinYMin meet" aria-hidden="true"
        onPointerDown={event => { inspect(event); if (event.pointerType === "touch") event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={inspect} onPointerLeave={event => { if (event.pointerType === "mouse") setHover(null); }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={primaryColour} stopOpacity=".19"/><stop offset="100%" stopColor={primaryColour} stopOpacity="0"/></linearGradient>
          {comparison === "usd" && <>
            <clipPath id={`${id}-gain`}><rect x="0" y="0" width={W} height={y(0)}/></clipPath>
            <clipPath id={`${id}-loss`}><rect x="0" y={y(0)} width={W} height={H - y(0)}/></clipPath>
            <linearGradient id={`${id}-gain-fill`} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={y(0)}><stop offset="0%" stopColor={primaryColour} stopOpacity=".19"/><stop offset="100%" stopColor={primaryColour} stopOpacity=".02"/></linearGradient>
            <linearGradient id={`${id}-loss-fill`} gradientUnits="userSpaceOnUse" x1="0" y1={y(0)} x2="0" y2={H - bottom}><stop offset="0%" stopColor="#fb7185" stopOpacity=".02"/><stop offset="100%" stopColor="#fb7185" stopOpacity=".19"/></linearGradient>
          </>}
        </defs>
        {Array.from({ length: 5 }, (_, i) => { const value = min + (max - min) * i / 4; return <g key={i}><line x1={left} x2={W - right} y1={y(value)} y2={y(value)} stroke="white" strokeOpacity=".055"/><text x={W - right + 12} y={y(value) + 4} fill="#71717a" fontSize="11">{Number(value.toFixed(0))}%</text></g>; })}
        <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="white" strokeOpacity=".15" strokeDasharray="4 5"/>
        {primaryVisible && (comparison === "usd" ? <g data-series="portfolio-usd">
          {(["gain", "loss"] as const).map(side => <g key={side} clipPath={`url(#${id}-${side})`}>
            <path d={`${portfolioPath} L${x(points.length - 1)},${y(0)} L${left},${y(0)} Z`} fill={`url(#${id}-${side}-fill)`}/>
          </g>)}
          <path data-return="gain" d={usdStrokePaths?.above} fill="none" stroke={primaryColour} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
          <path data-return="loss" d={usdStrokePaths?.below} fill="none" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        </g> : <><path d={`${portfolioPath} L${x(points.length - 1)},${H - bottom} L${left},${H - bottom} Z`} fill={`url(#${id})`}/><path data-series={denominated ? "portfolio-usd" : "portfolio"} d={portfolioPath} fill="none" stroke={primaryColour} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></>)}
        {secondaryVisible && <path data-series={denominated ? "btc-index" : "btc-market"} d={secondaryPath} fill="none" stroke="#a1a1aa" strokeWidth="1.7" strokeDasharray="5 6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
        {showTrades && primaryVisible && (denominated || !relative) && markers.map(({ event, i }) => <circle key={event.id} cx={x(i)} cy={y(primaryValues[i])} r="3.5" fill={event.kind === "buy" ? "#54d6b2" : "#ff8b52"} stroke="#0a0a0b" strokeWidth="1.5"/>)}
        {hover !== null && (primaryVisible || secondaryVisible) && <>
          <line x1={x(active)} x2={x(active)} y1={top} y2={H - bottom + 8} stroke="white" strokeOpacity=".2" strokeDasharray="3 4"/>
          {denominated && <g data-chart-guide="return" pointerEvents="none">
            <line x1={left} x2={W - right + 3} y1={y(inspectedValue)} y2={y(inspectedValue)} stroke={guideColour} strokeOpacity=".65" strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
            <rect x={W - right + 3} y={guideLabelY} width={right - 5} height="22" rx="4" fill={guideColour}/>
            <text x={W - right + 3 + (right - 5) / 2} y={guideLabelY + 14.5} textAnchor="middle" fill="#110d0f" fontFamily="system-ui, sans-serif" fontSize="10.5" fontWeight="600">{signedPct(inspectedValue)}</text>
          </g>}
          <circle cx={x(active)} cy={y(inspectedValue)} r="4" fill={inspectedColour}/>
        </>}
        {dateTicks.map((tick, i) => <text key={i} x={left + tick.fraction * width} y={H - 9} fill="#85858f" fontSize="12" fontFamily="system-ui, sans-serif" textAnchor={i === 0 ? "start" : i === dateTicks.length - 1 ? "end" : "middle"}>{new Date(tick.time).toLocaleDateString("en-AU", multipleYears ? { month: "short", year: "2-digit", timeZone } : { month: "short", day: "numeric", timeZone })}</text>)}
        {hover !== null && (primaryVisible || secondaryVisible) && <g data-chart-guide="date" pointerEvents="none">
          <rect x={dateGuideX} y={H - bottom + 8} width={dateGuideWidth} height="22" rx="4" fill={guideColour}/>
          <text x={dateGuideX + dateGuideWidth / 2} y={H - bottom + 22.5} textAnchor="middle" fill="#110d0f" fontFamily="system-ui, sans-serif" fontSize="10.5" fontWeight="600">{inspectedDate}</text>
        </g>}
      </svg>
      {!primaryVisible && !secondaryVisible && <p className="absolute inset-0 grid place-items-center text-sm text-zinc-500">Select a curve to show it.</p>}
    </div>
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pb-3 text-[10px] text-zinc-500 sm:px-6" aria-live="off">
      <span>{hover === null ? `${chartDate(points[0].at)} — ${chartDate(points.at(-1)!.at)}` : chartDate(points[active].at)}</span>
      <span>{hover !== null ? denominated ? `${primaryLabel} ${signedPct(primaryValues[active])}${hasBenchmark ? ` · ${benchmarkLabel} ${signedPct(secondaryValues[active])}` : ""}` : relative ? `BTC-relative ${signedPct(relativeValues[active])}` : `Difference ${signedPct(portfolio[active] - btc[active])}` : costLabel}</span>
    </div>
  </div>;
}

export function SpotAllocationChart({ points }: { points: SpotPoint[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (points.length < 2) return <p className="py-10 text-sm text-zinc-500">Select a longer period to see allocation history.</p>;
  const assets = [...new Set(points.flatMap(p => Object.keys(p.weights)))], W = 1080, H = 180;
  const x = (i: number) => i / (points.length - 1) * W;
  const lower = (i: number, assetIndex: number) => assets.slice(0, assetIndex).reduce((sum, asset) => sum + (points[i].weights[asset] ?? 0), 0);
  const active = selected ?? points.length - 1;
  return <div><svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full overflow-hidden rounded-xl" role="img" aria-label="Historical portfolio allocation by asset, from 0 to 100 percent."
    onPointerMove={e => { const box = e.currentTarget.getBoundingClientRect(); setSelected(Math.max(0, Math.min(points.length - 1, Math.round((e.clientX - box.left) / box.width * (points.length - 1))))); }} onPointerLeave={() => setSelected(null)}>
    {assets.map((asset, index) => {
      const upper = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${H - (lower(i, index) + (p.weights[asset] ?? 0)) * H / 100}`).join(" ");
      const bottom = points.map((_, i) => i).reverse().map(i => `L${x(i)},${H - lower(i, index) * H / 100}`).join(" ");
      return <path key={asset} d={`${upper} ${bottom} Z`} fill={spotColour(asset)} fillOpacity=".8"/>;
    })}
    {selected !== null && <line x1={x(active)} x2={x(active)} y1="0" y2={H} stroke="white" strokeOpacity=".7"/>}
  </svg><div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"><span className="text-zinc-500">{dateLabel(points[active].at)}</span>{assets.map(asset => <span key={asset} className="inline-flex items-center gap-2 text-zinc-300"><AssetLogo asset={asset} size={14}/><span>{asset} {(points[active].weights[asset] ?? 0).toFixed(1)}%</span></span>)}</div></div>;
}
