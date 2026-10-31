import assert from "node:assert/strict";
import test from "node:test";
import { ideaChartLevels, ideaMarketLevels } from "./idea-timeline-model";
import { ideaMarkets, ideaMarketTrades } from "./idea-timeline";
import { ideaDraftSchema, type PublicIdea } from "./workspace-model";
import { ideaEditorFields } from "./idea-editor-model";
import type { PerformanceTrade } from "./types";
const btc={symbol:"BTCUSDT",targetPrice:90000,invalidationPrice:80000};
const sol={symbol:"SOLUSDT",targetPrice:180,invalidationPrice:140};
const fields={title:"Market structure",thesis:"Range reclaim",target:"Range highs",invalidation:"Support fails",status:"active" as const,ideaAt:"2025-01-01T00:00:00Z",articleUrl:""};
const idea:PublicIdea={...fields,id:"idea-test",firstPublishedAt:fields.ideaAt,updatedAt:fields.ideaAt,tradeIds:[],chart:btc,charts:[btc,sol]};
const trades=[{id:"btc",symbol:"BTCUSDT",openedAt:fields.ideaAt},{id:"sol",symbol:"SOLUSDT",openedAt:fields.ideaAt},{id:"similar",symbol:"WBTCUSDT",openedAt:fields.ideaAt}] as PerformanceTrade[];
test("each market has its own levels and executions, including similarly named tickers",()=>{
  assert.deepEqual(ideaMarkets(idea,trades),["BTCUSDT","SOLUSDT","WBTCUSDT"]);
  assert.equal(ideaMarketLevels(idea,"SOLUSDT"),sol);
  assert.equal(ideaMarketLevels(idea,"ETHUSDT"),undefined);
  assert.deepEqual(ideaMarketTrades(trades,"BTCUSDT").map(t=>t.id),["btc"]);
  assert.deepEqual(ideaMarketTrades(trades,"SOLUSDT").map(t=>t.id),["sol"]);
  assert.deepEqual(ideaMarketTrades(trades,"ETHUSDT"),[]);
});
test("single-market ideas remain editable and clearing all markets never revives old levels",()=>{
  assert.deepEqual(ideaChartLevels({chart:btc}),[btc]);
  assert.deepEqual(ideaChartLevels({chart:btc,charts:[]}),[]);
  const legacy={id:"idea-test",name:"Legacy",thesis:"",target:"",invalidation:"",notes:"",createdAt:fields.ideaAt,updatedAt:fields.ideaAt};
  const edited=ideaEditorFields(legacy,{id:legacy.id,revision:1,fields:{...fields,chart:btc},published:false,publishedRevision:null});
  assert.deepEqual(edited.charts,[btc]);assert.equal(edited.chart,undefined);
});
test("multiple levels validate prices and reject duplicate markets, malformed tickers and excessive rows",()=>{
  assert.ok(ideaDraftSchema.safeParse({...fields,charts:[btc,sol]}).success);
  for(const charts of [[btc,btc],[{...sol,symbol:"sol"}],[{...sol,targetPrice:0}],Array.from({length:13},(_,i)=>({...btc,symbol:`M${i}USDT`}))]) {
    assert.equal(ideaDraftSchema.safeParse({...fields,charts}).success,false);
  }
  assert.ok(ideaDraftSchema.safeParse({...fields,charts:[]}).success);
});
