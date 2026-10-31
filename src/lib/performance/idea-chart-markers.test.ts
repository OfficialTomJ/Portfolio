import assert from "node:assert/strict";
import test from "node:test";
import { executionSide, tradeChartMarkers, tradeChartPeriod, visibleTradePeriod } from "./idea-chart-markers";
import type { PerformanceTrade } from "./types";
const candles=[0,1,3].map(i=>({time:1735689600+i*14400,open:100,high:110,low:90,close:105}));
const trade:PerformanceTrade={id:"trade-one",symbol:"BTCUSDT",direction:"Long",openedAt:"2025-01-01T00:30:00Z",closedAt:"2025-01-01T04:30:00Z",entryPrice:100,exitPrice:110,resultR:1};
test("buy/sell arrows preserve individual execution identities and isolate the selected trade",()=>{
  assert.deepEqual(tradeChartMarkers(candles,[],"","4h"),[]);
  const all=tradeChartMarkers(candles,[trade,{...trade,id:"trade-two"}],"","4h");
  assert.equal(all.length,4);assert.equal(new Set(all.map(m=>m.id)).size,4);
  assert.deepEqual(all.map(m=>[m.tradeId,m.side,m.shape,m.color]),[["trade-one","buy","arrowUp","#22c55e"],["trade-two","buy","arrowUp","#22c55e"],["trade-one","sell","arrowDown","#ef4444"],["trade-two","sell","arrowDown","#ef4444"]]);
  const selected=tradeChartMarkers(candles,[trade],trade.id,"4h");
  assert.deepEqual(selected.map(m=>[m.time,m.shape,m.text]),[[1735689600,"arrowUp","Buy · Entry"],[1735704000,"arrowDown","Sell · Exit"]]);
  assert.deepEqual(tradeChartMarkers(candles,[trade],"missing","4h"),[]);
});
test("short trades sell to enter and buy to exit regardless of whether the trade won",()=>{
  for(const resultR of [-1,1]) {
    const markers=tradeChartMarkers(candles,[{...trade,direction:"Short",resultR}],"","4h");
    assert.deepEqual(markers.map(m=>[m.leg,m.side,m.shape,m.color,m.position]),[["entry","sell","arrowDown","#ef4444","aboveBar"],["exit","buy","arrowUp","#22c55e","belowBar"]]);
  }
  assert.equal(executionSide("Long",false),"sell");
});
test("same-candle entry/exit arrows remain individually identifiable and define a single-candle period",()=>{
  const same={...trade,closedAt:"2025-01-01T02:00:00Z"};
  const markers=tradeChartMarkers(candles,[same],"","4h");assert.equal(markers.length,2);assert.notEqual(markers[0].id,markers[1].id);assert.equal(markers[0].time,markers[1].time);
  assert.deepEqual(tradeChartPeriod(candles,same,"4h"),{entry:1735689600,exit:1735689600});
  assert.deepEqual(tradeChartPeriod(candles,trade,"4h"),{entry:1735689600,exit:1735704000});
});
test("missing and out-of-window fills never become markers or a falsely clamped period",()=>{
  const missing={...trade,openedAt:"2024-12-31T23:00:00Z",closedAt:"2025-01-01T09:00:00Z"};
  assert.deepEqual(tradeChartMarkers(candles,[missing],trade.id,"4h"),[]);
  assert.equal(tradeChartPeriod(candles,missing,"4h"),null);
  assert.equal(tradeChartPeriod(candles,{...trade,closedAt:"2025-01-01T09:00:00Z"},"4h"),null);
});

test("holding-period highlights clip to the visible plot and keep same-candle fills visible",()=>{
  assert.deepEqual(visibleTradePeriod(20,80,100,8),{left:16,width:68});
  assert.deepEqual(visibleTradePeriod(-20,40,100,8),{left:0,width:44});
  assert.deepEqual(visibleTradePeriod(98,150,100,8),{left:94,width:6});
  assert.deepEqual(visibleTradePeriod(50,50,100,8),{left:46,width:8});
  assert.equal(visibleTradePeriod(-40,-20,100,8),null);
  assert.equal(visibleTradePeriod(120,150,100,8),null);
});
