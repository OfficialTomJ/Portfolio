import assert from "node:assert/strict";
import test from "node:test";
import { eventCandle, ideaChartWindow, ideaMarkets, ideaMilestones } from "./idea-timeline";
import { publicIdeaSchema, type PublicIdea } from "./workspace-model";
import { ideaPublicationState } from "./idea-publication-state";
import { asrSchema } from "./asr-model";
const idea:PublicIdea={id:"idea-one",title:"Rough setup",thesis:"An initial thesis",target:"Resistance",invalidation:"A daily close below support",status:"active",ideaAt:"2025-01-01T00:00:00Z",firstPublishedAt:"2025-02-01T00:00:00Z",updatedAt:"2025-02-02T00:00:00Z",articleUrl:"",tradeIds:[],chart:{symbol:"BTCUSDT",targetPrice:120,invalidationPrice:90},updates:[{id:"11111111-1111-4111-8111-111111111111",at:"2025-01-03T00:00:00Z",title:"New context",thesis:"A subsequent thesis",target:"",invalidation:"",publishedAt:"2025-02-02T00:00:00Z"}]};
test("timeline preserves stated dates and actual publication, and carries unchanged conditions forward",()=>{
  const milestones=ideaMilestones(idea);
  assert.equal(milestones[1].at,"2025-01-03T00:00:00Z");
  assert.equal(milestones[1].publishedAt,"2025-02-02T00:00:00Z");
  assert.equal(milestones[1].target,"Resistance");assert.equal(milestones[1].invalidation,idea.invalidation);
  assert.equal(milestones[1].chart?.symbol,"BTCUSDT");
  assert.equal(ideaMilestones({...idea,updates:[{...idea.updates![0],chart:null}]} )[1].chart,undefined,"explicitly cleared chart levels were inherited");
  assert.deepEqual(ideaMarkets({...idea,updates:[{...idea.updates![0],chart:{symbol:"SOLUSDT",targetPrice:200,invalidationPrice:100}}]},[{symbol:"ETHUSDT"} as never]),["BTCUSDT","ETHUSDT"],"retired timeline markets must not appear in the current idea selector");
});
test("chart markers never clamp missing or out-of-window executions to an edge candle",()=>{
  const candles=[0,1,3].map(i=>({time:1735689600+i*14400,open:100,high:110,low:90,close:105}));
  assert.equal(eventCandle(candles,"2024-12-31T23:59:59Z","4h"),null);
  assert.equal(eventCandle(candles,"2025-01-01T00:01:00Z","4h"),1735689600);
  assert.equal(eventCandle(candles,"2025-01-01T09:00:00Z","4h"),null,"missing candle gap acquired a marker");
  assert.equal(eventCandle(candles,"2025-01-02T00:00:00Z","4h"),null);
});
test("long ideas use a bounded window and selecting a historical update refocuses it",()=>{
  const milestones=ideaMilestones({...idea,updates:[{...idea.updates![0],at:"2026-10-01T00:00:00Z"}]});
  const window=ideaChartWindow(milestones,[],"2025-01-01T00:00:00Z",undefined,Date.parse("2026-10-31"));
  assert.equal(window.interval,"1d");assert.equal(window.clipped,true);assert.ok(window.end-window.start<=470*86400);
  assert.ok(window.start<Date.parse("2025-01-01")/1000&&window.end>Date.parse("2025-01-01")/1000);
});
test("rough drafts accept written invalidation and optional charts; public update shape rejects private fields and backdating",()=>{
  const {id:_id,firstPublishedAt:_first,updatedAt:_updated,tradeIds:_ids,...fields}=idea;void _id;void _first;void _updated;void _ids;
  const clean={...fields,updates:undefined};
  assert.ok(publicIdeaSchema.safeParse({...clean,chart:undefined,invalidation:"Failure of a moving average to hold"}).success);
  const update={...idea.updates![0]};delete (update as Partial<typeof update>).publishedAt;
  assert.equal(publicIdeaSchema.safeParse({...clean,updates:[{...update,privateNotes:"private"}]}).success,false);
  assert.equal(publicIdeaSchema.safeParse({...clean,updates:[{...update,at:"2024-12-01T00:00:00Z"}]}).success,false);
  assert.equal(publicIdeaSchema.safeParse({...clean,updates:[update,update]}).success,false);
  assert.equal(publicIdeaSchema.safeParse({...clean,chart:{...idea.chart,targetPrice:0}}).success,false);
});
test("publication state distinguishes unpublished drafts and changes to a still-public version",()=>{
  const draft={id:"idea",revision:2,fields:{} as never,published:false,publishedRevision:null};
  assert.equal(ideaPublicationState(),"draft");assert.equal(ideaPublicationState(draft),"draft");
  assert.equal(ideaPublicationState({...draft,published:true,publishedRevision:2}),"published");
  assert.equal(ideaPublicationState({...draft,published:true,publishedRevision:1}),"changes");
});
test("ASR accepts partial reviews while rejecting changes to trade facts or publication",()=>{
  assert.ok(asrSchema.safeParse({expectedR:null,valid:null,asrComments:"Private rough review"}).success);
  assert.equal(asrSchema.safeParse({expectedR:2,valid:true,asrComments:"",resultR:5}).success,false);
  assert.equal(asrSchema.safeParse({expectedR:Infinity,valid:true,asrComments:""}).success,false);
});
