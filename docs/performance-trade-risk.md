# Per-trade risk upgrade

## Calculation contract

The journal keeps its fixed base 1R unit. Each trade records a private `riskR` value: 1 means 1R risk, 2 means 2R risk, and fractional positive values are allowed. Actual result R continues to use the locked base unit, not the trade's risk budget. A trade risking 2R and returning +4R therefore keeps its +4R result. ASR expected R uses that same base unit. The editor and its helper code express risk only in R.

## Implementation plan

1. Add `riskR` to private trade annotations, defaulting missing historical values to 1. Prior trades become editable immediately without a database migration or changes to source PnL.
2. Add Risk (R) to the shared trade editor, for active, pending-review and published trades. Display saved risk in R in private trade rows.
3. Persist risk alongside existing annotations in the same transaction, revision conflict check and before/after history. Older clients that omit the field preserve the saved risk.
4. Keep risk attached to the stable trade ID already shared by active and closed trades. Sync and publication do not overwrite private annotations.
5. Preserve risk during legacy metadata migration. Verify historical defaults, positive/fractional inputs, invalid input rejection, audit preservation and unchanged result/ASR calculations.

## Usage and rollout

For a new trade, open the private journal's Active tab, select Edit trade, enter Risk (R), and save. For historical trades, use Edit trade in any closed-trade tab or the individual review page. The input starts at 1R for legacy records. Saves remain separate from publication.

This upgrade does not require a backfill command: the private reader supplies 1R for every missing value, and the next edit persists it. Deployment is required before the hosted journal exposes the field. Private risk is never copied into public metadata, result datasets or sharing images.
