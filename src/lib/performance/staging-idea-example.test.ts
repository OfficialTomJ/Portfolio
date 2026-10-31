import assert from "node:assert/strict";
import test from "node:test";
import { isStagingIdeaExampleEnvironment, stagingExampleTrades } from "./staging-idea-example";
const env={MONGODB_DB:"blueprint_dev",NEXT_PUBLIC_SITE_URL:"https://mentor.stage.thomas-johnston.com",VERCEL_ENV:"preview"};
test("sample idea trades require the staging hostname and development database, and are forbidden on production deployments",()=>{
  assert.equal(isStagingIdeaExampleEnvironment(env),true);
  assert.equal(isStagingIdeaExampleEnvironment({...env,VERCEL_ENV:"production"}),false);
  assert.equal(isStagingIdeaExampleEnvironment({...env,MONGODB_DB:"blueprint"}),false);
  assert.equal(isStagingIdeaExampleEnvironment({...env,NEXT_PUBLIC_SITE_URL:"https://mentor.thomas-johnston.com"}),false);
  assert.equal(isStagingIdeaExampleEnvironment({...env,MONGODB_DB:undefined}),false);
});
test("sample trade DTOs reject malformed data and never pass through private fields",()=>{
  const raw={id:"trade-11111111111111111111",symbol:"BTCUSDT",direction:"Long",openedAt:"2026-10-24T10:00:00Z",closedAt:"2026-10-24T18:00:00Z",entryPrice:82000,exitPrice:81000,resultR:-1,description:"Sample only",privateNotes:"SECRET",asrComments:"SECRET"};
  const trades=stagingExampleTrades([raw]);assert.equal(trades.length,1);assert.ok(!JSON.stringify(trades).includes("SECRET"));
  assert.deepEqual(stagingExampleTrades([raw,raw]),[]);assert.deepEqual(stagingExampleTrades([{...raw,resultR:Infinity}]),[]);assert.deepEqual(stagingExampleTrades(null),[]);
});
