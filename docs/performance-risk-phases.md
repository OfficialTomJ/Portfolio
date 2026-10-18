# Prospective journal risk changes

The private base risk amount converts source closed PnL to R. It is different from each trade's allocation (`riskR`, e.g. 1R or 2R). Risk versions are selected at position entry, including entries exactly at the effective timestamp. Existing cycle locks, historical PnL, annotations, published results and immutable share images retain their original values.

A new version can include the fixed public “Risk reduced” notice. Only its opaque event ID, effective timestamp, title and explanatory text reach the public dataset. Dollar amounts, account identity and private reasons remain private. The notice is scoped to the source account from the last successful sync and appears only once that sync's as-of time reaches the effective time. Existing versions without a notice remain unchanged.

Interactive public, private and ASR charts show the dated dashed line and a keyboard-accessible details panel. Date filters hide out-of-range lines but retain the latest applicable disclosure. Chart-only flat anchors cover a pause with no new closes; statistics and equity calculations do not include these anchors. Share images include the marker/disclosure and new cache fingerprints; previously stored URLs continue to serve their original images. Cumulative R is a normalised trading measure, not dollar PnL or percentage account return.

## Activation after consolidation

1. Complete and verify trade consolidation first. Keep the account flat while preparing and applying the change. Select a future UTC effective timestamp before the next position entry.
2. Run the read-only preview with the intended environment/account credentials:

   ```sh
   npm run performance:risk:set -- --amount 50 --effective-from '<future UTC ISO timestamp>' --public-notice --reason 'Reduced size for consistency trial'
   ```

   The example is a private journal base unit, not an order-sizing command. Confirm that this matches the risk unit of the connected source. This application currently syncs one Bybit feed; it does not configure Hyro or Breakout execution risk. Set $50/$100 execution sizing separately in the relevant trading platform. Do not apply the Breakout amount to the Hyro feed or infer a second account integration.
3. Review the preview's database, environment, source account hash, current amount and next version. To apply, repeat the exact request with `--apply --expected-account '<preview sourceAccountId>' --expected-current-amount '<preview previousAmount>'`. Production additionally requires `--confirm-production`. Applying rechecks identity, current amount, latest known entry and live flat positions. It rejects backdating, conflicting scheduled versions and notices for a non-reduction. An identical completed request can be retried without another insertion.
4. Hold off opening positions until the version is applied, then allow normal sync after the effective timestamp. Verify the notice and first newly opened trade's lock, private PnL / base unit and public R. Pre-existing trades keep the old denominator even if they close later. Scaling into an existing position retains its original cycle lock.

The command inserts one risk-version document containing the notice atomically. It does not resize orders, rewrite historical results or publish pending trades. The preview performs broker/database reads only. There is no automatic production activation on deployment. If the wrong future version is staged, pause entries and inspect it before correction; do not reset history or delete locked versions as a rollback.

## Staging verification

`/performance/risk-preview` and `/api/performance/risk-preview/og` require all three conditions: `VERCEL_ENV=preview`, `MONGODB_DB=blueprint_dev`, `PERFORMANCE_RISK_PREVIEW=1`. Otherwise they return 404. They use synthetic fixtures and the actual chart/image renderers without persisting fixtures or changing broker risk. Scenarios: default crosses the change; `?scenario=gap` pauses after it; `?scenario=future` hides an upcoming change. Do not enable the demonstration flag in production.

Validation covers entry-time boundaries, old locks, public DTO privacy, filtered context, paused timeline anchors, image keys and cutover guards. Browser checks cover desktop/mobile, opening/closing the panel with keyboard, ASR visibility toggles, date filtering and the PNG renderer. Production activation remains a separate action after consolidation and PR review.
