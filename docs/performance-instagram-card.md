# Performance trade Instagram card

This is an offline publishing template for closed Performance Journal trades. It does not add a website route, expose an image publicly, or change the journal UI.

## Generate a card

With the production performance database variables available in `.env.local`, run:

```bash
npm run performance:instagram -- --trade trade-b1d79f6abf7979429967
```

The default output is a 1080×1350 PNG in `output/social/`. Generated images are local artifacts and must not be committed.

To choose a different local destination:

```bash
npm run performance:instagram -- \
  --trade trade-b1d79f6abf7979429967 \
  --out output/social/sol-trade.png
```

## Data and layout

- The trade facts come from the published closed-trades collection in MongoDB.
- The chart uses Binance 1-hour candles when available, otherwise Bybit public linear 1-hour candles, with context before entry and after exit. The image labels the selected source.
- Results are presented only in R; the image contains no position size or dollar PnL.
- LONG and SHORT cards automatically use the journal's green and red direction colors.
- The right-side price scale is calculated from the exact candle window used for the trade.

Review every generated card visually before posting it. This command is intentionally manual and does not publish or upload the result.
