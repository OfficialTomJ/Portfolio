# Performance Journal — results, public ideas and reconciliation

31 October 2026. Product and implementation plan following the PR status review.
Status: staging implementation ready for owner testing, including historical trade
editing. See [the staging review and test guide](performance-journal-staging-review.md).
Actual trade reconciliation and production release remain separate from this review.

## Direction and priority

The active project is the existing Performance Journal: present Thomas's closed
trading results clearly, explain the ideas behind the trades, and invite readers
to Chronicles Discord. Breakout CSV imports are the source for new trading data.
Thomas must be able to reconcile new and historical trades himself from one
private admin page, regardless of their original source.

Reuse the combined journal preview's visual direction: compact heading, dominant
result, large chart, restrained controls, an immediate Discord CTA, and supporting
detail below. This is an R-based trading journal; the combined capital model and
Spot functionality are parked. Keep existing public journal and trade URLs.

| Work | Decision |
| --- | --- |
| PRs #61, #56 and #65 | Closed without merging on 31 October 2026 |
| Breakout imports | Continue from merged #67 and #68; Bybit polling stays retired |
| Results-first journal, public ideas, complete trade editing | Current priority |
| Discord / Chronicles / product signup | Follow up after the journal changes are delivered and reviewed |
| F&G Discord update bot | Include in that same follow-up, including outstanding trial/scheduling checks |
| Spot / combined portfolio | Park; preserve mock work and documents as references |
| Crypto watchlist / scanner | Park; preserve existing work |
| Backup / monitoring improvements | Separate existing backlog; no expansion in this project |

The follow-up is a dependency in this work plan, not a scheduled reminder or an
instruction to activate bots. The existing combined mock staging deployment is a
design reference, not evidence that these real-data features are implemented.

## Problem and outcomes

The public journal currently spreads results, supporting statistics and community
links across a comparatively busy interface. Ideas are private categories, so a
visitor cannot follow the analysis through multiple trade attempts. Imports work,
but the normal editor cannot correct actual entry, exit or realised R; routine
reconciliation still needs technical assistance.

The release succeeds when:

1. A visitor can identify the selected period's published net R, see the result
   curve and find the Discord invitation immediately.
2. A visitor can read a published idea, understand its reasoning and inspect its
   linked published trades without needing an account.
3. Thomas can import, correct, categorise, review and publish trades from one
   authenticated workspace, without editing the database or running repair scripts.
4. A correction produces consistent results in the chart, statistics, trade page,
   linked idea and newly generated social image after publication.
5. Original source records, historical decisions and private information survive
   the change and remain recoverable.

## Public experience

### Opening screen

Use the current dark/orange brand and the combined preview's composition:

1. Compact **Performance Journal** heading and short source/coverage line.
2. A dominant **Net result: +X.XX R** for the selected period, including negative
   and zero states with equally clear treatment.
3. Supporting closed-trade count, win rate and maximum drawdown. Keep the main
   result visually dominant; put remaining statistics in expandable detail.
4. A full-width cumulative R chart with useful tooltips, zero baseline and concise
   period controls: YTD, 30D, 90D and All; custom dates/year in More.
5. A chart-footer CTA: **Follow the ideas behind the results — Join Discord**.

Default to 30-day history. The number, curve, counts and supporting statistics must use the
same published dataset and period. Label it as a published closed-trade record;
imports, unresolved records and open positions do not imply complete account PnL.
Show last publication/update and actual covered dates without presenting an old
export as fresh trading coverage. Retain simulated/prop-environment disclosure.

At 1280 × 800 and 375 × 812, aim to show the main result, meaningful chart area
and primary CTA in the opening screen after site navigation. At 320 × 568 allow
natural scrolling. No horizontal page overflow or inaccessible clipped controls.

The CTA links directly to the confirmed Chronicles invite. Centralise that
destination: the current journal and invitation pilot contain different invite
URLs, so verify the intended live destination before staging handoff. Reuse the
direct-link approach; no email popup or signup gate is needed for this journal
release. The wider Discord entry/product signup work remains deferred.

### Below the chart

- **Ideas behind the trades:** a small initial set of published idea summaries
  with title, thesis excerpt, status, publication date, linked closed-trade count
  and net R from those published trades. An idea without results says so.
- **Trade history:** newest closes first, labelled R result, asset, direction,
  dates, trade type and an optional linked idea. Search and Day/Swing filters
  remain available without dominating the opening screen.
- **Statistics and calendar:** expand for the existing detailed measures/calendar.
- **About this record:** concise R explanation, coverage and environment disclosure.
- A final Discord invitation; Substack is a secondary contextual link.

Selecting a calendar day or trade filter must state what has been filtered.
Idea cards show their all-time published result with that label; period-specific
results, if offered, must be explicitly labelled rather than silently changing
the meaning of an idea's outcome.

### Public ideas

Preserve the existing private idea IDs and assignments. An idea is the analytical
thesis; its linked trades are execution attempts. Several trades may share an
idea, and an idea may span more than one asset.

Add an explicit public draft containing title, summary/thesis, optional target,
optional invalidation, status and optional external analysis link. Keep private
working notes separate. Existing private fields are not automatically published;
the editor can deliberately copy chosen content into the public draft.

Use draft, active, completed and invalidated states. Public status is owner
supplied; imported price activity must not invent an invalidation or completion.
Distinguish idea date from first publication and last update. Backfilled analysis
must not appear to have been publicly available before it was first published.

Provide stable idea detail URLs, linked from both the journal and relevant public
trade pages. Each detail shows the approved thesis, chronological linked published
trades and their net realised R. It includes a Discord CTA and can link to a real
Substack article when supplied. No invented article, screenshot or performance.

Publishing an idea and publishing its trades are separate actions. A public idea
can exist before it has a published closed trade. Public responses must not reveal
unpublished trade counts, private results, assignments or pending positions.
Unpublishing an idea removes its narrative, not its trades' published economics.
An idea is a grouping of trades, never an additional performance contribution.

## One private workspace

Keep `/performance/review` as the single management entry point. Use in-page views
for **Trades**, **Ideas**, **Imports** and **Publication & history**. Preserve
existing deep links and full trade review for optional detailed charts; all routine
editing must be possible without leaving this workspace.

The workspace shows private totals and clear counts for needs reconciliation,
ready for review/publication and unpublished changes. Default the trade list to
newest first; search, status, asset, idea and date filters help find older records.
Retain ASR and its comparison as optional private tools.

### Import

Preserve upload → read-only preview → select rows → confirm import. Retain digest,
revision, idempotency and duplicate checks; preview/cancel saves nothing. Recent
rolling exports do not delete earlier imports or reset reconciled values.

Show imported rows, locked duplicates and conflicts clearly. A conflict must lead
to an actionable editor with the original evidence and reason, rather than a
permanently read-only dead end. Importing and source activation remain distinct
from publication. Keep the existing source boundary and archived Bybit history;
do not guess matches or copy old assignments to Breakout trades automatically.

The current importer supports one explicitly selected Breakout account and its
closed-position schema. Preserve that scope for this release; do not combine
exports from multiple accounts that lack an account identifier.

### Edit and reconcile a trade

The same editor opens from every existing historical trade and new import:
legacy Bybit trades, earlier Breakout imports, pending or already-published
trades, held reconciliation rows and archived/excluded history. Historical
editing is a must-have in this release, not an import-only feature or follow-up.
No CSV re-upload, exchange connection or technical repair script is required to
edit an existing trade. It contains the following understandable groups:

| Group | Editable information |
| --- | --- |
| Trade facts | Asset, direction, entry/exit timestamps, entry/exit prices |
| Result | Actual realised net R; private source monetary details and calculation where available |
| Risk and execution | Intended Risk (R), optional stop, quantity, fees and other supported private execution details |
| Idea and classification | Existing/new idea, Day/Swing, private strategies |
| Review | Expected R, validity, ASR and private notes |
| Public presentation | Approved description and public-preview controls |
| Reconciliation | Include/hold/exclude decision and a short reason for correcting source facts |

Actual R, intended Risk (R) and Expected R are three independent labelled values.
Changing intended risk must not rescale historical actual results. A manual actual
R correction is allowed for fees, management or source reconciliation; it must
not be rejected simply because it cannot be inferred from the entry/exit prices.

Offer source-calculated and manually reconciled result modes. Retain the imported
net result and original conversion basis; distinguish them from the journal's
effective value. When an input affecting the calculated result changes, preview
the resulting R or require explicit confirmation that manual R stays unchanged.
Do not invent a stop, risk base or missing fee to manufacture a calculation.
For older trades with incomplete source evidence, show which original details
are unavailable and allow an explicitly reconciled value with a reason. Preserve
the existing trade ID, account/source scope, notes and idea assignments; do not
fabricate an import record to make a historical trade editable.

Validate positive prices/quantities where supplied, finite R, valid timestamps
and exit not before entry. Support break-even, losing and fractional-R trades.
Preserve timestamp precision, explicit timezone labels and stable internal IDs.
Hold records with incomplete facts until resolved. Keep imported identity and
account provenance separate from editable display fields.

Allow Thomas to inspect competing source rows, choose a canonical record and
exclude a duplicate with a reason. Resolving a hold records an explicit decision;
editing one field must not silently bypass unrelated unresolved conflicts.
Excluded rows remain visible in history and can be restored after validation.
Advanced split/merge and manual creation of entirely missing source positions are
follow-up capabilities; ordinary fact/result corrections must ship in this release.

### Save, preview and publish

**Save changes** always writes a private draft. A separate **Publish trade** or
**Update published trade** confirmation shows the exact before/after public facts
and result impact. Thus already-published trades are editable for reconciliation,
without silently changing public history on a normal Save.

Keep the prior public version active until a replacement is explicitly confirmed.
On confirmation, update the effective public trade snapshot atomically, retaining
the stable trade URL and earlier version for audit. Derive public statistics and
idea results from those same effective published snapshots. A failed image job
must not ambiguously roll back a successful data publication; report its status
and allow retry. New immutable image keys must reflect the corrected public facts;
older image URLs keep their previous content.

The same draft/preview/publish principle applies to idea content and public idea
assignments. Moving a privately assigned trade must not silently alter a published
idea page. Preview an assignment change on both affected idea summaries.

Editing an archived or excluded trade does not automatically restore it to
metrics, bypass a hold or change the Bybit/Breakout source boundary. Inclusion
and publication decisions remain explicit. Apply the same correction history,
private draft and public-update flow to historical and newly imported trades.

## Data, access and recovery

- Store immutable raw CSV/source evidence alongside versioned reconciled drafts;
  repeated imports cannot overwrite the owner's effective correction.
- Store correction history with actor, timestamp, reason and before/after values.
  Restoring an earlier version creates a new audited revision.
- Preserve raw monetary amounts, account details, quantities, fees, private risk
  bases, private notes, strategies and ASR behind verified-admin access.
- Public payloads use a nested allowlist. Current public trade prices may remain
  visible, but adding a private editor field must not add it to public responses.
- Retain same-origin mutation checks, revision/fingerprint conflict detection,
  transactional writes and safe retries. A stale tab keeps its draft and asks for
  refresh; a lost response requires a status check before a second publication.
- Draft state and access configuration cannot be enabled by a public query string.
  No private analytics, financial exports or real-data test fixtures in source.
- Reuse the existing MongoDB-backed journal, review, import and idea structures
  where practical. The fictional combined workspace is not the real-data store.
- Back up affected records before a migration or real-data reconciliation. Keep
  source activation, import and publication rollback independent. Do not restart
  Bybit polling on rollback.

## Delivery sequence

1. **Layout and public-content design:** adapt the combined preview's layout to
   the R journal and define public idea cards/detail and private editor states.
   Use clearly labelled fictional fixtures for review; no production changes.
2. **Reconciliation foundation:** add versioned fact/result drafts, hold resolution,
   full trade editing across legacy history and new imports, and publication of
   corrected snapshots. Connect historical records, the existing importer and
   ideas into the single workspace.
3. **Public ideas and real-data presentation:** implement explicit idea publication,
   linked trade pages, consistent summaries and the results-first public layout.
   Keep old public URLs and earlier Bybit coverage working.
4. **Staging acceptance:** exercise the full flow with synthetic/disposable data;
   present desktop/mobile public pages and the complete admin flow for review.
5. **Actual data update:** obtain the latest account-specific Breakout export,
   preview it, import the chosen rows and reconcile the trade facts/ideas. Review
   the source boundary and publication impact separately. No fabricated latest
   trades or bulk publication merely to populate the redesign.
6. **Release:** prepare a focused PR, complete build/regression/browser checks and
   deploy the reviewed implementation. Production data publication remains an
   explicit journal action.
7. **Deferred follow-up:** revisit Discord/Chronicles/product-aware signup and the
   F&G Discord update bot together, using the finished journal's conversion flow
   as their starting point. Spot and scanner remain parked unless reprioritised.

## Acceptance and measurement

- The opening result, chart and totals agree for YTD, rolling, all-time and custom
  periods, including empty periods, losses and break-even. Calendar filters are
  labelled, and published trades are counted once.
- Importing the same or overlapping export is idempotent and preserves corrections.
  Invalid files and stale confirmations make no partial writes.
- Thomas can correct entry, exit, dates, direction and actual R; refresh and repeat
  imports retain the edit. Changing risk allocation leaves actual R unchanged.
- The same editing tools work on an existing Bybit trade, an older Breakout trade,
  a new import and an already-published trade. Historical edits need no re-import
  or active exchange connection and preserve IDs, notes, original evidence and
  assignments. Missing historical evidence is labelled rather than invented.
- Editing archived/excluded history does not reactivate it, change source coverage
  or add duplicate results. Restoring inclusion requires a separate validated
  decision; publishing any corrected public facts remains explicit.
- A held row can be resolved or excluded from the normal UI with recorded evidence;
  unknown conflicts cannot become publishable accidentally.
- Editing a published trade changes only its draft until confirmation. After
  confirmation, the trade page, curve, metrics, idea summary and new image agree;
  prior audit versions and image URLs remain available.
- Existing private ideas/notes are never public by default. Draft idea updates and
  assignments remain private until publication. Only published linked closed
  trades contribute to public idea summaries.
- Anonymous/non-admin access to private routes and APIs fails. Public HTML, RSC,
  API responses, metadata, images and analytics contain no private values.
- Mobile/desktop keyboard tests cover editor focus, cancel/unsaved changes, errors,
  publication confirmation, filters and the direct Discord link. Build, types and
  performance tests pass; transaction scenarios use disposable databases.
- Track public Discord CTA impressions/clicks by placement, plus idea/detail opens.
  Compare the first 30 days with a recorded pre-release baseline when available;
  no conversion uplift is assumed. A click is not proof of a Discord join.
- In staging acceptance, Thomas should be able to import a file and reconcile an
  ordinary trade entirely through the UI; record completion time and blockers.

## Decisions to confirm during design

Non-blocking design defaults are 30-day history, direct Discord entry, public idea publication
separate from trades, and explicit publication of corrections. Confirm the live
Discord invite before handoff. Before actual data import, establish which Breakout
account the export belongs to and its coverage, and confirm any source-boundary
change. No hard deadline or multi-account requirement is assumed.

## References

- [Combined preview review](unified-performance-journal-v1-review.md) — layout reference only
- [Existing trade ideas](performance-ideas.md) — private workflow to preserve
- [Breakout importer runbook](https://github.com/OfficialTomJ/Portfolio/blob/main/docs/performance-breakout-import.md)
- [Discord/product direction](discord-product-entry-plan.md) — deferred follow-up
- [F&G trial and outstanding checks](fng-discord-updates-plan.md) — same deferred follow-up
