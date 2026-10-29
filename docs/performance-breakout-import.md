# Breakout CSV imports

The private journal uses Breakout closed-position exports. Bybit account ingestion is retired at the shared account-access boundary, including manual sync and legacy CLI paths. Public exchange candle requests remain available as labelled chart proxies. The source-sync GitHub cron has been removed; keep that workflow disabled. Manual source freshness has no 15-minute heartbeat. Image integrity and serving monitoring remain independent.

## Upload and review

Open `/performance/review` as the verified, allowlisted creator and choose **Upload Breakout CSV**. The initial release supports one explicit account, **Breakout account 1**. No history-start date is required. Recent-trades-only exports are supported: each row is compared with stored position identities, identical positions are skipped and new ones are added. Missing rows never remove earlier imports. Overlap between export date ranges does not itself make positions ambiguous.

The supported columns are:

```text
instrument,side,quantity,entry_price,exit_price,entry_time,exit_time,realized_pnl,fees,net_pnl
```

Column order, UTF-8 BOMs, standard quoting and LF/CRLF are supported. Instruments use `/USD`, sides use `long`/`short`, and timestamps must include a timezone. Files must be nonempty, at most 2 MB and at most 5,000 rows. The entire file must pass validation before any import collection or document is written. An invalid final row rejects the entire file. Net P&L must exactly equal realized P&L minus fees. The importer never evaluates spreadsheet formulas or guesses missing columns.

Successful uploads archive the original bytes and source values privately, then atomically save candidates and the batch summary. Renamed/reordered/repeated exports do not duplicate identical positions. Full timestamp precision and decimal values participate in source identity. Indistinguishable duplicate rows within one file are rejected, because the export contains no position IDs to distinguish them. Transaction failures leave no partial trade/account/batch changes. A commit whose response was lost can be recovered by retrying the same file.

Clean positions enter the normal private review workspace. Overlapping same-symbol/direction positions and changed rows sharing an entry identity enter **Reconciliation**, excluded from metrics and publication. Existing pending rows can become held when a later upload introduces overlap. Published results remain immutable. There is no automatic grouping, cross-platform matching, history repair, exclusion of tiny trades or annotation transfer. An agent can inspect the archived rows and make a separately reviewed correction later.

The CSV contains no intended risk or stop settings. Edit and save each new trade's **Risk (R)** before publication; 1R is only the initial proposal. Trade budgets such as 0.5R or 2R do not change the fixed base unit used for actual results. Net P&L is divided by the journal base unit, with fees deducted only once. This format does not establish separate funding/swap treatment; the exported net total is retained as supplied.

## Source switch and history

Uploading never publishes a trade or switches public sources. The private metrics preview uses the proposed Breakout period and keeps eligible earlier Bybit trades. **Bybit history** provides the original stored results and review notes, without counting the covered period twice.

When ready, **Use Breakout as result source** explicitly switches the public period from the earliest imported entry's UTC day. Its confirmation explains that covered Bybit results will be archived from public metrics, and that only approved Breakout trades appear publicly. The originals and annotations remain in their collections and private history; earlier Bybit results stay public. This is a source boundary based on imported evidence, not a guessed trade-to-trade reconciliation. Legacy trades spanning the boundary remain in private history.

Later partial exports cannot move the recorded history start forward. Older backfills can extend private history backward automatically. If Breakout is already active, its public boundary remains pinned until **Use Breakout as result source** is confirmed for that earlier period; those earlier positions cannot publish before confirmation. Uploading therefore never silently removes more Bybit results from the public journal.

After switching, publish clean reviewed positions individually. Publication checks the exact fingerprint and current source evidence in a transaction, including risk confirmation and any overlaps introduced by later uploads. Stale or held candidates fail closed. Source activation and publication serialize with uploads on the account revision. Metadata editing retains the existing revision-conflict checks and audit trail.

Closed-position exports do not supply active trades. The admin reports **Last imported** and **History through** separately and does not treat a newly uploaded old file as current source coverage. Recent import summaries are visible in **Import history**. All account IDs, raw CSVs, quantities, fees, dollar results and private reviews remain behind the admin gate and outside public trade DTOs. Breakout instruments display USD, with exchange candles labelled as proxies.

## Operator and recovery notes

- Review/list/approve CLI commands now use stored candidates and never refresh Bybit. The old account sync, scale-in attribution and Bybit risk-configuration commands are retired. Use the admin Risk (R) editor for trade budgets.
- Keep unused Bybit account credentials removed/revoked after deployment verification. Do not rotate shared scheduler secrets as part of this cutover.
- Pause the retired Bybit freshness check in Healthchecks. The monitoring workflow no longer sends that check fake success/failure pings. Preserve the independent image check.
- Image generation runs after source activation/publication. Failures cannot undo a successful import or publication. Use the existing image backfill command if needed. Versioned image keys include public source/result facts.
- A bad CSV is not archived. The client displays validation errors; successful import history contains only committed batches. If a network response is lost, refresh history or retry the same file. Concurrent first uploads may return a retryable conflict.
- Back up affected account/source/publication/annotation documents before an agent performs any manual reconciliation or reverses an activated source boundary. Do not delete the old Bybit history or automatically re-enable polling on rollback.
- The export has no account or position IDs. Account origin cannot be independently verified, and arbitrary source corrections without stable entry identity may need agent review. Upload the original export from the selected account. The importer does not claim to reconstruct missing fills or combine partial positions into strategy ideas.

## Validation

`npm run performance:test` covers parser rejection, decimal/timestamp identity, overlap handling, stream limits, source boundaries and the existing journal contracts. To run the opt-in transaction integration test, provide a disposable local MongoDB replica set URI and run:

```sh
BREAKOUT_MONGO_TEST=1 npx tsx --test src/lib/performance/breakout-store.mongo.test.ts
```

The test uses a uniquely named test database and removes only that database. It verifies rejection with zero writes, re-imports, immutable history, stale/held publication, risk confirmation, corrections and concurrent uploads. Use synthetic fixtures for tests and screenshots; never commit personal trade exports or financial snapshots.
