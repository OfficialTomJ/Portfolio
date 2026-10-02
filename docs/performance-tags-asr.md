# Trade classification and Advanced Self Review

The private journal at /performance/review manages pending, published and active trades. The editor has a single public trade type (DAY, SWING or unset), a public description, multiple private strategy tags, private notes and ASR. Active positions accept classification, strategies and notes; ASR becomes editable after closure. Saving never approves publication or changes actual source results.

The editor opens from data already loaded by the authenticated page. A background refresh replaces untouched fields only, never an in-progress draft. Private data is not persisted in browser storage or shared caches. Saves check the original revision and reject conflicting edits.

## Filters

Public pages offer period and multi-select trade type. Private pages add searchable multi-select strategies and an Unclassified type option. No selection means unrestricted, including unclassified trades. Types match ANY selected type; strategies match ANY selected strategy; the two groups combine with AND. Each trade is counted once even if it matches several strategies. Removable chips wrap on mobile. Clearing filters preserves the period, while changing filters clears a selected calendar day. The default remains rolling 30 days.

Filters apply to actual results, statistics, trade lists and the public calendar. Active positions follow classification filters but do not contribute to closed results. The private chart defaults to All actual results, including closed trades awaiting publication or ASR review, within the selected period and classification filters. ASR comparison is opt-in and uses the same reviewed trades and closing dates for actual and expected curves, with independent curve toggles and a private validity filter. Review coverage remains explicit. Expected R and validity are both required for a completed ASR; zero R and invalid are valid assessments.

## Storage and privacy

- performance_trade_metadata: public trade type and description, keyed by stable trade ID. No strategy IDs.
- performance_strategy_catalogue: private reusable names, with deterministic IDs from normalized names.
- performance_private_reviews: private strategy IDs, notes, ASR, revision, editor and timestamp.
- performance_private_review_history: immutable before/after records for edits and migration.

Public loaders project only trade type and description. They never read strategy catalogues, legacy tag catalogues or private reviews. Private names and IDs are excluded from public HTML/RSC, SEO metadata, sharing images, URLs and analytics events. Public descriptions are deliberately public and rendered as escaped plain text. Invalid ASR assessments do not suppress actual public results. Metadata writes are transactional and separate from ingestion, risk calculation and publication approval.

Verified-admin authentication protects all private reads and writes; writes also require same-origin requests. Private responses are no-store and noindex. Preview deployments must use blueprint_dev; production uses blueprint_prod. The daily prod-to-dev restore copies new collections once present in production and replaces corresponding dev records. Dev-only collections absent from the dump can persist. Preview edits are test data, not durable production reviews.

## Legacy migration

cli-migrate-metadata.ts is dry-run by default. Run with NODE_PATH=node_modules/next/dist/compiled NODE_OPTIONS=--conditions=react-server npx tsx src/lib/performance/cli-migrate-metadata.ts, then add --apply after reviewing the counts. Production writes additionally require --confirm-production and the production database selected explicitly in the environment. Staging work must never use that flag.

Recognised Day/Swing labels migrate to trade type; all other legacy tags move to private strategies. Conflicting type labels stay unset and are flagged in private audit history. Each trade migration is atomic, preserves notes/ASR/descriptions, increments the revision and records original documents for reconstruction. Re-running is safe: only records still containing legacy tagIds are migrated. The legacy catalogue remains available to private readers for compatibility after older snapshots are restored; public readers always ignore it. Run migration again after restoring an older dev dump to populate public classifications. Saving through the new editor also writes the new schema safely. An active cycle's stable future trade ID keeps its metadata through closure.

## Verification

Test OR/AND matching, deduplication, empty selections, unclassified trades, classification migration/conflicts, strategy creation/reuse, refresh, stale revisions, active editing and identical paired ASR dates. Inspect public HTML/RSC and sharing image responses for private fields, names and IDs. Verify signed-out and non-admin access rejection, small-phone/desktop wrapping, keyboard-accessible popovers, and instant editor fields while background requests are slow or fail. No trade is published during these checks.
