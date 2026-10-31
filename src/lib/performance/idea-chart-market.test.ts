import assert from "node:assert/strict";
import test from "node:test";
import { loadIdeaChartMarket } from "./idea-chart-market";
import { ideaChartWindow, type IdeaMilestone } from "./idea-timeline";
import type { MarketCandles } from "./types";
const start=1735689600;
const milestone:IdeaMilestone={id:"current",at:"2025-02-01T00:00:00Z",publishedAt:"2025-02-01T00:00:00Z",title:"Idea",thesis:"Thesis",target:"Target",invalidation:"Invalidation"};
test("idea timeframe windows add context, respect the selected interval and bound hourly history",()=>{
  const now=Date.parse("2025-03-01T00:00:00Z");
  for(const [interval,days] of [["1h",7],["4h",14],["1d",90]] as const) {
    const range=ideaChartWindow([milestone],[],milestone.at,undefined,now,interval);
    assert.equal(range.interval,interval);assert.equal(Date.parse(milestone.at)/1000-range.start,days*86400);assert.equal(range.clipped,false);
  }
  const old={...milestone,at:"2020-01-01T00:00:00Z"};
  const range=ideaChartWindow([old,milestone],[],milestone.at,undefined,now,"1h");
  assert.equal(range.clipped,true);assert.ok(range.end-range.start<=1498*3600);assert.ok(range.start<Date.parse(milestone.at)/1000&&range.end>Date.parse(milestone.at)/1000);
});
test("long reference windows page past 500 bars with one source and retain late execution candles",async()=>{
  const queries:URLSearchParams[]=[],controller=new AbortController();
  const request:typeof fetch=async(url,options)=>{
    assert.equal(options?.signal,controller.signal);
    const q=new URL(String(url),"https://stage.invalid").searchParams;queries.push(q);
    const from=Number(q.get("start")),end=Number(q.get("end"));
    const candles=[];for(let time=from;time<=end;time+=3600)candles.push({time,open:100,high:110,low:90,close:105});
    return new Response(JSON.stringify({source:"bybit",candles} satisfies MarketCandles));
  };
  const data=await loadIdeaChartMarket({symbol:"BTCUSDT",start,end:start+1100*3600,interval:"1h",signal:controller.signal},request);
  assert.equal(queries.length,3);assert.equal(queries[0].get("source"),null);assert.equal(queries[1].get("source"),"bybit");
  assert.equal(data.candles.length,1101);assert.equal(data.candles.at(-1)?.time,start+1100*3600);assert.equal(new Set(data.candles.map(c=>c.time)).size,data.candles.length);
  assert.ok(queries.every(q=>Number(q.get("end"))-Number(q.get("start"))<500*3600));
});
test("oversized windows and inconsistent or failed pages never return a silently truncated chart",async()=>{
  let requests=0;
  const request:typeof fetch=async()=>{requests++;return new Response(JSON.stringify({source:requests===1?"binance":"bybit",candles:[{time:start,open:100,high:110,low:90,close:105}]}));};
  await assert.rejects(loadIdeaChartMarket({symbol:"BTCUSDT",start,end:start+2100*3600,interval:"1h"},request),/date range/);assert.equal(requests,0);
  await assert.rejects(loadIdeaChartMarket({symbol:"BTCUSDT",start,end:start+600*3600,interval:"1h"},request),/consistently/);
  await assert.rejects(loadIdeaChartMarket({symbol:"BTCUSDT",start,end:start+5*3600,interval:"1h"},async()=>new Response("",{status:502})),/temporarily unavailable/);
});
