import assert from "node:assert/strict";
import test from "node:test";
import { tradeChartMarkers } from "./idea-chart-markers";
import type { PerformanceTrade } from "./types";
const candles=[0,1,3].map(i=>({time:1735689600+i*14400,open:100,high:110,low:90,close:105}));
const trade:PerformanceTrade={id:"trade-one",symbol:"BTCUSDT",direction:"Long",openedAt:"2025-01-01T00:30:00Z",closedAt:"2025-01-01T04:30:00Z",entryPrice:100,exitPrice:110,resultR:1};
test("idea chart displays only executions, groups dense events and isolates a selected trade",()=>{
  assert.deepEqual(tradeChartMarkers(candles,[],"","4h"),[],"an idea without trades must have no thesis marker");
  const grouped=tradeChartMarkers(candles,[trade,{...trade,id:"trade-two"}],"","4h");
  assert.deepEqual(grouped.map(m=>[m.time,m.shape,m.text]),[[1735689600,"circle","2"],[1735704000,"circle","2"]]);
  const selected=tradeChartMarkers(candles,[trade],trade.id,"4h");
  assert.deepEqual(selected.map(m=>[m.time,m.shape,m.text]),[[1735689600,"arrowUp","Entry"],[1735704000,"arrowDown","Exit"]]);
  assert.deepEqual(tradeChartMarkers(candles,[trade],"missing","4h"),[]);
});
test("missing and out-of-window fills never become chart markers",()=>{
  assert.deepEqual(tradeChartMarkers(candles,[{...trade,openedAt:"2024-12-31T23:00:00Z",closedAt:"2025-01-01T09:00:00Z"}],trade.id,"4h"),[]);
});
