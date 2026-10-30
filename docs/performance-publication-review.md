# Performance journal publication review

The active workflow is now [Breakout CSV imports](performance-breakout-import.md).
Bybit account ingestion is retired. Admin and CLI publication operate on stored
candidates and never run an exchange refresh. Keep original Bybit data and notes
as history; use the explicit source switch to exclude its covered period from
current results. The historical Bybit ingestion description below is retained
for interpreting archived records, not as an operational procedure.

The scheduled and manual syncs continue to capture Bybit positions, orders, executions, closed PnL, risk versions, and deduplicated raw snapshots. Open positions never enter the public trades collection. A newly closed, valid result is stored as a private `pending_review` candidate, not automatically published.

The public journal reads only `performance_published_trades`. Existing published results remain visible. A new result is published only after an explicit review of its exact candidate fingerprint. The fingerprint covers the displayed trade, underlying closed PnL records, and locked risk version. If any of those change before publication, the approval is invalidated and the result stays private. Overlap/attribution holds, exclusions, and unresolved results cannot be approved through this process.

When the account owner requests publication of a specific closed trade:

1. From an environment configured for the intended journal MongoDB database, run `npm run performance:review -- list`. This reads stored pending facts, R and fingerprints without contacting Bybit. Do not share private source data.
2. Match the intended result by symbol, direction, opening/closing times, and R. Resolve any ambiguous attribution before approval.
3. Run `npm run performance:review -- approve <trade-id> <fingerprint>`. This publishes only an exact valid stored candidate, using the same transactional safeguards as admin. Breakout source activation and risk confirmation must already be complete. No sync is run.
4. Check the public journal and trade detail page after deployment/cache propagation.

Do not approve a candidate just because the trade ID matches. The fingerprint must match the candidate reviewed in step 2. If the command reports a changed candidate or an unpublished result, inspect the latest private records and repeat the review; do not directly edit the public collection.
