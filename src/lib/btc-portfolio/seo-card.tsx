/* eslint-disable @next/next/no-img-element -- ImageResponse requires intrinsic image elements. */
import type { CSSProperties } from "react";
import type { PortfolioSeoModel } from "./seo-model";
import { pct } from "./view";

const GREEN = "#7ad9b6", ORANGE = "#ff8b52";
const position = (left: number, top: number, extra: CSSProperties = {}): CSSProperties => ({ position: "absolute", display: "flex", left, top, ...extra });
function PortfolioGraph({ model }: { model: PortfolioSeoModel }) {
  const W = 730, H = 426, L = 32, R = W - 64, T = 74, B = H - 39;
  const values = model.points.map(point => point.value), min = Math.min(0, ...values) - 7, max = Math.max(1, ...values) + 7;
  const times = model.points.map(point => Date.parse(point.at)), span = times.at(-1)! - times[0];
  const x = (i: number) => span ? L + (times[i] - times[0]) / span * (R - L) : R;
  const y = (value: number) => T + (max - value) / (max - min) * (B - T);
  const path = values.map((value, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
  const ticks = [0, .25, .5, .75, 1];
  const dates = [...new Map([0, .33, .66, 1].map(fraction => {
    const label = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(times[0] + fraction * span));
    return [label, { label, fraction }];
  })).values()];
  const updated = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(model.asOf));
  return <div style={position(410, 92, { width: W, height: H, border: "1px solid rgba(255,255,255,.11)", borderRadius: 16, overflow: "hidden", background: "#07090d" })}>
    <div style={position(32, 24, { fontSize: 14, color: "#d4d4d8", fontWeight: 700, letterSpacing: 1.5 })}>PORTFOLIO · USD</div>
    <div style={{ position: "absolute", display: "flex", right: 26, top: 25, fontSize: 12, color: "#71717a" }}>{updated} UTC</div>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={GREEN} stopOpacity=".2"/><stop offset="1" stopColor={GREEN} stopOpacity=".01"/></linearGradient><clipPath id="gain"><rect x="0" y="0" width={W} height={y(0)}/></clipPath><clipPath id="loss"><rect x="0" y={y(0)} width={W} height={H - y(0)}/></clipPath></defs>
      {ticks.map((n, i) => <line key={i} x1={L} x2={R} y1={T + n * (B - T)} y2={T + n * (B - T)} stroke="rgba(255,255,255,.06)"/>)}
      <line x1={L} x2={R} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.2)" strokeDasharray="5 6"/>
      <path d={`${path} L${R},${B} L${L},${B} Z`} fill="url(#area)"/>
      <path d={path} clipPath="url(#gain)" fill="none" stroke={GREEN} strokeWidth="3.5" strokeLinejoin="round"/>
      <path d={path} clipPath="url(#loss)" fill="none" stroke="#fb7185" strokeWidth="3.5" strokeLinejoin="round"/>
      <circle cx={R} cy={y(values.at(-1)!)} r="5" fill={values.at(-1)! < 0 ? "#fb7185" : GREEN} stroke="#07090d" strokeWidth="2"/>
    </svg>
    {ticks.map((n, i) => <div key={i} style={position(R + 13, T + n * (B - T) - 6, { fontSize: 11, color: "#71717a" })}>{Math.round(max - n * (max - min))}%</div>)}
    {dates.map(({ label, fraction }) => <div key={label} style={position(Math.min(W - 80, Math.max(L, L + fraction * (R - L) - 15)), H - 28, { fontSize: 12, color: "#71717a" })}>{label}</div>)}
  </div>;
}
export function PortfolioOpenGraphCard({ model, logo }: { model: PortfolioSeoModel; logo: string }) {
  const result = pct(model.usdReturn), gap = pct(model.btcGap);
  return <div style={{ position: "relative", display: "flex", width: 1200, height: 630, overflow: "hidden", color: "white", background: "radial-gradient(circle at 13% 13%, rgba(255,103,25,.15), transparent 42%), linear-gradient(135deg, #020203 0%, #090a0d 100%)", fontFamily: "sans-serif" }}>
    <div style={position(0, 0, { width: 1200, height: 5, background: "#ff6719" })}/>
    <div style={position(60, 57, { color: ORANGE, fontSize: 18, fontWeight: 700, letterSpacing: 3.6 })}>PUBLIC PORTFOLIO</div>
    <div style={position(60, 112, { padding: "9px 16px", borderRadius: 999, border: "1px solid rgba(255,103,25,.34)", background: "rgba(255,103,25,.10)", color: "#ff9b6a", fontSize: 14, fontWeight: 700, letterSpacing: 2 })}>{model.year} · YEAR TO DATE</div>
    <div style={position(60, 195, { color: "#71717a", fontSize: 14, fontWeight: 700, letterSpacing: 2.4 })}>USD RETURN</div>
    <div style={position(60, 225, { color: model.usdReturn < 0 ? "#fb7185" : GREEN, fontSize: Math.min(76, 76 * 7 / result.length), fontWeight: 700, letterSpacing: -3 })}>{result}</div>
    <div style={position(60, 340, { width: 305, height: 1, background: "rgba(255,255,255,.09)" })}/>
    <div style={position(60, 375, { color: "#71717a", fontSize: 12, fontWeight: 700, letterSpacing: 1.8 })}>RETURN VS BTC</div>
    <div style={position(60, 405, { color: ORANGE, fontSize: Math.min(40, 40 * 8 / gap.length), fontWeight: 600 })}>{gap}</div>
    <PortfolioGraph model={model}/>
    <div style={position(60, 568, { alignItems: "center", gap: 12, color: "#a1a1aa", fontSize: 17 })}><img src={logo} alt="" width={26} height={26}/>Thomas Johnston</div>
    <div style={{ position: "absolute", display: "flex", right: 60, top: 574, fontSize: 14, color: "#71717a" }}>mentor.thomas-johnston.com/portfolio</div>
  </div>;
}
