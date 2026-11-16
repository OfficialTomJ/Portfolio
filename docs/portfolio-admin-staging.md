# Public Portfolio: database editor and staging review

The visitor page at `/portfolio` is read only. The creator editor lives at
`/admin/portfolio`; the old backfill route opens this editor. This delivery is
limited to staging. Production cannot activate the new database mode.

## Database boundary

The approved backfill and supporting evidence are retained in private database
collections. The new workspace is a copy, preserving original reconstruction,
historical source, research and journal records. Migration compares the complete
percentage curve, allocation and editorial list before activation.

- `portfolio_review_workspaces`: private draft ledger, model marks, historical
  series, cash bridge, closed prop inputs, editorial notes and validation state.
- `portfolio_review_private_audit`: private prior versions, actor, reason and time.
- `portfolio_review_public_releases`: immutable, allowlisted visitor snapshots.
- `portfolio_review_public_pointers`: the active reviewed staging release.

Visitor requests read only the release and its pointer. Source records, capital,
quantities, fills, fees, wallet identifiers, private research and audit notes are
not returned. The public page retains percentage performance, combined allocation
and approved editorial summaries. Unit market prices remain separate public
quotes. Historical weights, execution lists and leverage are withheld.

The current spot ledger remains a normalised reconstruction, not actual capital
or verified custody balances. The historical fixed-reference curve, current spot
estimate and closed prop overlay retain their separate approved methodologies.
The editor labels model units explicitly. It does not infer actual cold-storage
holdings, silently convert the history to time-weighted returns, or activate API
trading. The year-end article's return requires a separate period/base comparison.

## Editor workflow

1. Overview compares the draft with the active staging release.
2. Transactions supports private additions, corrections and voiding with a reason.
   Replay rejects invalid balances, chronology and missing price coverage.
3. Ideas supports text, period, asset, optional published Substack URL, visibility
   and pinning within its year. Source drafts remain private references.
4. Performance inputs exposes the private structured ledger, historical series,
   marks and prop inputs for advanced corrections. Original evidence is retained;
   editing a model does not certify it as an actual account statement.
5. Public preview uses the same calculation and privacy projection as publication.
6. Validate, review the preview and confirm **Publish staging release**. Financial
   calculations, allocation and editorial notes change together. Validation is
   tied to the draft fingerprint and becomes stale after a save.
7. Releases can restore an earlier visitor snapshot while retaining the draft.

Saves require a verified creator session, same-origin request, matching revision
and unique request ID. Private responses are uncacheable. Concurrent edits and
changed retry payloads are rejected. Publication and rollback use one database
transaction for the workspace, release and active pointer. Optional undefined
fields are omitted when stored, preserving the strict visitor contract.

## Staging configuration

Enable `BTC_PORTFOLIO_MODE=database` only for a Vercel preview, with the existing
development database. Credentials are server environment variables, never files
in this PR or browser variables. No production environment or domain is changed.
Legacy journal pages redirect to the portfolio and old journal/Spot APIs are
disabled while this review mode is active. The old fictional editor API is
disabled in database mode. The new visitor API supports GET only.

## Acceptance checks

- Original backfill hashes and accepted notes survive migration unchanged.
- An admin draft save does not alter the visitor release.
- Invalid edits do not partially save; stale revisions cannot overwrite changes.
- Visible and hidden notes, published links and year pinning work in preview.
- A current validation is required; stale or unreviewed commands cannot publish.
- Publication and rollback update the whole release atomically.
- Anonymous/non-admin requests cannot read or mutate private data.
- Visitor HTML, JSON and client assets contain no private input or source fields.
- USD/vs BTC, UTC periods, hover badges, filters and mobile layouts work on staging.
- Production remains on its existing deployment; database mode is disabled there.

Private database backups and their restore helpers live outside the checkout and
are not committed or deployed. Restore verification checks BSON boundaries,
document counts and checksums. Recovery restores into a new database first and
refuses to overwrite an existing database. Staging code rollback uses the retained
previous deployment; release rollback uses the editor's private history.
