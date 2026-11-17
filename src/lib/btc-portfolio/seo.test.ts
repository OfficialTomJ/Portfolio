import test from "node:test";
import assert from "node:assert/strict";
import { portfolioPublicPolicy, portfolioPublicDatabaseName, portfolioReviewPolicy } from "./mode-policy";
import { portfolioSeoModel, portfolioImagePath, parsePortfolioImageKey, PORTFOLIO_TITLE, PORTFOLIO_DESCRIPTION, PORTFOLIO_CANONICAL } from "./seo-model";
import { portfolioMetadata } from "./seo-metadata";
import { replayPortfolio } from "./engine";
import { makeMockLedger } from "./fixture";

const sample = () => replayPortfolio(makeMockLedger()).publicData;
test("production public access does not enable the editor or fall back to dev", () => {
  const env = { NODE_ENV: "production", VERCEL_ENV: "production", BTC_PORTFOLIO_MODE: "database", PORTFOLIO_PUBLIC_MODE: "published" };
  assert.equal(portfolioPublicPolicy(env), true);
  assert.equal(portfolioReviewPolicy(env).database, false);
  assert.equal(portfolioPublicPolicy({ ...env, PORTFOLIO_PUBLIC_MODE: "off" }), false);
  assert.equal(portfolioPublicDatabaseName({ VERCEL_ENV: "production", PORTFOLIO_MONGODB_DB: "blueprint_prod" }), "blueprint_prod");
  assert.throws(() => portfolioPublicDatabaseName({ VERCEL_ENV: "production", PORTFOLIO_MONGODB_DB: "blueprint_dev" }));
  assert.throws(() => portfolioPublicDatabaseName({ VERCEL_ENV: "production", MONGODB_DB: "blueprint_prod" }));
  assert.equal(portfolioPublicDatabaseName({ VERCEL_ENV: "production", MONGODB_DB: "blueprint_dev", PORTFOLIO_MONGODB_DB: "blueprint_prod" }), "blueprint_prod");
  assert.throws(() => portfolioPublicDatabaseName({ VERCEL_ENV: "preview", MONGODB_DB: "blueprint_prod" }));
});
test("image refresh keys change with the UTC day or public performance, never private fields", () => {
  const data = sample(), day = new Date("2026-11-17T00:01:00Z"), model = portfolioSeoModel(data, day);
  const same = portfolioSeoModel(data, new Date("2026-11-17T23:59:00Z"));
  assert.equal(model.key, same.key);
  assert.notEqual(model.key, portfolioSeoModel(data, new Date("2026-11-18T00:00:00Z")).key);
  const changed = structuredClone(data); changed.points.at(-1)!.portfolioIndex *= 1.1;
  assert.notEqual(model.key, portfolioSeoModel(changed, day).key);
  const privateExtras = { ...data, capital: "PRIVATE_CAPITAL_SENTINEL", wallet: "PRIVATE_WALLET_SENTINEL", privateNotes: "PRIVATE_NOTES_SENTINEL" };
  assert.deepEqual(portfolioSeoModel(privateExtras, day), model);
  assert(!JSON.stringify(model).includes("SENTINEL"));
  assert.equal(parsePortfolioImageKey(portfolioImagePath(model.key).split("/").at(-1)!), model.key);
  assert.equal(parsePortfolioImageKey("../../workspace"), null);
  assert.equal(parsePortfolioImageKey("p1-bad"), null);
});
test("SEO title, description and social image share one current public snapshot", () => {
  const data = sample(), model = portfolioSeoModel(data, new Date("2026-11-17T00:00:00Z"));
  const first = data.points.filter(p => p.at >= "2026-01-01T00:00:00Z")[0], last = data.points.at(-1)!;
  const expected = (last.portfolioIndex / first.portfolioIndex - 1) * 100;
  assert(Math.abs(model.usdReturn - expected) < 1e-9);
  const metadata = portfolioMetadata(model, "https://mentor.thomas-johnston.com", true);
  assert.deepEqual(metadata.title, { absolute: PORTFOLIO_TITLE });
  assert.equal(metadata.description, PORTFOLIO_DESCRIPTION);
  assert.equal(metadata.alternates?.canonical, PORTFOLIO_CANONICAL);
  assert.equal((metadata.twitter as { card: string }).card, "summary_large_image");
  assert.equal((metadata.robots as { index: boolean }).index, true);
  assert.equal((portfolioMetadata(model, "https://example.vercel.app", false).robots as { index: boolean }).index, false);
  assert.equal((portfolioMetadata(null, "https://mentor.thomas-johnston.com", true).robots as { index: boolean }).index, false);
});
