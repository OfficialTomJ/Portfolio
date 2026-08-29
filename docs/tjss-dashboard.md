# TJSS Method Dashboard

A members-only Bitcoin dashboard on the mentor site: live Fear & Greed signals
overlaid on a price chart, plus a backtester.

Route: `/dashboard` (physically `src/app/mentor/dashboard/page.tsx`, served on the
mentor host via the subdomain rewrite in `src/middleware.ts`). It ships as part of
The Blueprint course and shares that gate exactly, `getMemberSession()` in
`src/lib/session.ts` is the single definition of "member", used by both.

## Where the strategy lives

**Not in this repo.** This repository is public, so it holds no tuned parameter,
no backtest result, and no research.

| What | Where |
|---|---|
| Tuned parameters, presets, allocation-mode copy | `tjss_presets` / `tjss_modes` in MongoDB |
| Backtest evidence + limitations shown to members | `tjss_evidence` in MongoDB |
| Strategy write-up | `tjss_docs` in MongoDB |
| Analysis-only modules (tax, rivals, Monte Carlo, benchmarks) | `research/`, gitignored, local only |

Seed with `npm run tjss:seed` (reads `research/tjss/`, upserts into Mongo).
Changing the strategy is a re-seed, not a deploy. If the collections are empty
every endpoint returns **503** rather than falling back to a default, a missing
strategy fails visibly instead of silently serving one nobody chose.

## Server-side by construction

Signals, backtests, timeframe aggregation, EMA projection and risk metrics all
run on the server. The client is presentational: it receives points to plot and
numbers to display.

A member sends only their own choices, which preset, which allocation mode,
which timeframe, how much capital, what date range. Strategy parameters are not
accepted from a request; unknown fields are dropped by the zod schemas in
`src/lib/tjss/schema.ts`, so injecting one has no effect.

The invariant that keeps it that way: **everything `src/Components/tjss/**`
imports from `@/lib/tjss/*` must be `import type`.** A value import means engine
code has entered the browser bundle.

```
src/lib/tjss/
  presets.ts     server-only reader for the Mongo-held strategy
  view.ts        server-side chart payload (aggregation, EMA projection)
  schema.ts      zod validation of member inputs
  types.ts       wire shapes only, no defaults, no thresholds
  market.ts      aligns candles + F&G into Bar[]
  fng.ts         Fear & Greed from alternative.me (cached in Mongo)
  price.ts       BTC daily candles from Binance (cached in Mongo)

src/app/api/tjss/
  presets/route.ts   GET  (gated) → preset + mode labels, evidence copy
  market/route.ts    GET  (gated) → chart payload + current state
  backtest/route.ts  POST (gated) → trades, equity, stats, risk metrics
```

## Data sources (both free, no API key)

- **Fear & Greed:** `https://api.alternative.me/fng/?limit=0` (history to 2018-02-01),
  cached in `tjss_fng`, refreshed hourly (same TTL as price, so a new
  UTC day never has a candle with no sentiment beside it).
- **BTC price:** Binance daily klines (mirror `data-api.binance.vision` as fallback),
  cached in `tjss_price`, topped up hourly.

Both collections auto-create; no new environment variables. On a fetch failure the
API falls back to the cached copy.

## Local development

`npm run dev` opens gated routes automatically on localhost, `getSession()`
returns a synthetic verified member. This cannot activate in a deployed build
(`NODE_ENV` is `development` only under `next dev`). Set `DEV_REAL_AUTH=1` in
`.env.local` to exercise the real sign-in flow or check the signed-out gate.

## Verifying

```bash
npm run build          # type-check + production build
npm run tjss:seed      # (re)load the strategy into Mongo
```

Then confirm no strategy data reached the browser:

```bash
grep -rn "@/lib/tjss" src/Components/          # must be `import type` only
grep -rlE 'trimGreedFloor|deepValueBoost|fearWeightMax' .next/static/   # must be empty
```

## Scope

BTC only. Alerts (email/push) are intentionally not built yet; because the engine
is pure, a daily cron route can evaluate the current state without touching it.

> **Not financial advice.** Educational tooling only. The dashboard reports risk
> before return deliberately, the drawdown reduction is the property that holds
> up across holdouts; the return edge is not.
