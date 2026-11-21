# Live portfolio valuation

Public returns, the Bitcoin comparison and current allocation are repriced from the accepted release's spot holdings and USD cash. A shared Kraken WebSocket updates the visible page on market ticks; the public API obtains timestamped Kraken prices every 15-second client refresh as a fallback. Browser titles follow the repriced YTD return. Private balances, quantities, source records and custody details never enter the public API.

The exact original ledger marks are prepared once per accepted release in `portfolio_public_valuation_bases`. This collection contains only the release ID, valuation date and public asset unit prices. Preparing a basis verifies the source workspace matches the published performance and allocation. It does not change the immutable release, its publication time or the private ledger.

With an administrator connection supplied through the environment, run the preparation command first without `--apply` to verify it, then with `--apply` to store the basis:

```sh
node --env-file=/path/to/admin.env --import tsx src/lib/btc-portfolio/cli-prepare-live-valuation.ts --database=blueprint_dev --apply
```

Use `--database=blueprint_prod` for the production release. Prepare a new basis after publishing a new holdings release. Unsupported assets, margin positions, non-USD cash or mismatched/unreconciled inputs retain the saved snapshot with delayed status. Public runtime access only needs read access to the basis collection; no private workspace access is required.

Each calculation uses the original accepted endpoint and relative allocation, then applies current price ratios. USD cash stays constant. Portfolio and benchmark endpoints advance together only when every required price is valid and fresh. Provisional endpoints are replaced, preserving accepted historical points. Failed price requests retain the last successful live snapshot where available, with delayed status and its actual valuation time; the successful API check time remains separate.

This tracks market movement on the latest recorded holdings. Trades, deposits, withdrawals, financing and newly closed prop results require a new accepted holdings release. It does not connect a private exchange account or import new activity. Missing daily history between the release and the live endpoint is not invented. Social image generation continues to use the accepted release, avoiding a new permanent image for every tick.

Rollback: redeploy the preceding application version. Existing releases and publication pointers are unchanged; the additive basis record may remain unused.
