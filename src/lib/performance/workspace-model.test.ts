import { test } from "node:test";
import assert from "node:assert/strict";
import { editSchema, publicFacts, publicIdeaSchema, type TradeEdit } from "./workspace-model";
import { tradeSocialImageKey } from "./social-image-keys";
const edit:TradeEdit={facts:{symbol:"BTCUSDT",direction:"Long",openedAt:"2025-01-01T00:00:00Z",closedAt:"2025-01-02T00:00:00Z",entryPrice:100,exitPrice:90,resultR:2},inclusion:"included",reason:"Reconcile managed position",resultMode:"manual",riskR:2,stopPrice:null,quantity:5,fees:2,netPnl:2000,riskBasis:1000,tradeType:"SWING",description:"Public explanation",strategyIds:[],privateNotes:"private sentinel",asrComments:"private assessment",expectedR:3,valid:true,ideaId:null,resolveHold:false};
test("manual realised R is independent of price direction, risk allocation and expected R",()=>{
  assert.equal(editSchema.parse(edit).facts.resultR,2);
  assert.equal(editSchema.parse({...edit,riskR:.5,expectedR:10}).facts.resultR,2);
});
test("public correction projection does not expose execution or review data",()=>{
  const projected=publicFacts("trade-11111111111111111111","bybit",edit);
  assert.deepEqual(Object.keys(projected).sort(),["id","source","symbol","direction","openedAt","closedAt","entryPrice","exitPrice","resultR","tradeType","description"].sort());
  assert.ok(!JSON.stringify(projected).includes("private sentinel"));
});
test("published fact corrections generate a new immutable social image key",()=>{
  const original=publicFacts("trade-11111111111111111111","bybit",edit);
  assert.notEqual(tradeSocialImageKey(original),tradeSocialImageKey({...original,resultR:1.25}));
  assert.notEqual(tradeSocialImageKey(original),tradeSocialImageKey({...original,entryPrice:101}));
});
test("incomplete histories stay editable while held, but cannot be included",()=>{
  const held={...edit,inclusion:"held",facts:{...edit.facts,closedAt:null,exitPrice:null,resultR:null}};
  assert.equal(editSchema.safeParse(held).success,true);
  assert.equal(editSchema.safeParse({...held,inclusion:"included"}).success,false);
});
test("rejects stale-shape fields, nonfinite values, invalid date order and inconsistent source calculations",()=>{
  for(const value of [{...edit,unexpected:1},{...edit,riskR:0},{...edit,facts:{...edit.facts,resultR:Infinity}},{...edit,facts:{...edit.facts,closedAt:"2024-01-01T00:00:00Z"}},{...edit,resultMode:"source",netPnl:1000}])assert.equal(editSchema.safeParse(value).success,false);
});
test("public ideas reject javascript links and private-field passthrough",()=>{
  const idea={title:"Test idea",thesis:"A public thesis",target:"",invalidation:"",status:"active",ideaAt:"2025-01-01T00:00:00Z",articleUrl:""};
  assert.equal(publicIdeaSchema.safeParse(idea).success,true);
  assert.equal(publicIdeaSchema.safeParse({...idea,articleUrl:"javascript:alert(1)"}).success,false);
  assert.equal(publicIdeaSchema.safeParse({...idea,notes:"Private"}).success,false);
});
