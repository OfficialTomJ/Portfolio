# Admin trade ideas

Create ideas and categorise trades in the **Trade ideas** section of `/admin`.
The former localhost experiment at `/performance/review/ideas` is removed; it
has no redirect. Review pages do not expose idea-editing controls.

## Workflow

- Create an idea with a name, thesis, target, invalidation and private notes.
  Only the name is required, so historical gaps do not require invented data.
- Select historical trades and assign them to an existing or new idea.
  Each canonical trade has at most one idea; ideas can span symbols.
- Use **Edit trade** on an admin history row to choose an idea or create one
  within the existing trade editor. The idea and any trade edits commit in
  one transaction when **Save changes** succeeds. Creation is deferred until
  that save; cancelling the panel creates no idea.
- Search and filter by idea, assigned/unassigned status, symbol, strategy,
  direction or entry date. Filters clear the batch selection.
- Move or unassign trades before deleting an empty idea. New closed trades
  appear unassigned; open positions remain outside this historical workflow.

The idea summary reports known net base R, winning R, realised losses and a
chronological trade timeline. Unknown results are omitted and labelled as
partial totals; they are never interpreted as zero or as planned risk.
Excluded/unresolved closed cycles can be grouped provisionally. Duplicate
legacy aliases remain visible in Exceptions but cannot be assigned or counted.

## Persistence and access

The existing MongoDB collections are reused without a data migration:

- `performance_private_ideas`
- `performance_private_ideas_assignments`
- `performance_private_ideas_state`
- `performance_private_ideas_history`

Existing IDs, assignments, workspace revisions and history remain intact.
All records are scoped to the current connected account and exchange
environment. Revision checks reject stale changes instead of overwriting
another tab's edit; the panel retains its draft and offers a reload.

The page and APIs require the same verified, allowlisted admin session as
private performance review. Mutation endpoints also require a matching
browser origin. Admin pages and API responses are private/no-store and
noindex. This feature does not use a development-only host gate.

Idea details and assignment IDs are never added to public trade metadata,
publication payloads, social images or public performance calculations.
Saving an idea does not publish, sync the exchange or introduce idea-budget
or trading-management rules.

The configured database determines which saved categories are visible. A
deployment using another database or account does not automatically receive
development records. Any separate transfer must preserve exact trade IDs and
account scope, and report unmatched records rather than guessing matches.

## Verification

Run `npm run performance:test` and `npx tsc --noEmit`.

For database transaction checks:

```sh
IDEAS_MONGO_TEST=1 npx tsx --test src/lib/performance/ideas-repository.mongo.test.ts
```

This test uses disposable collection names and checks persistence, account
separation, audit history, concurrent edits and rollback when an idea save
joins a failing trade-editor transaction. It drops only its own collections.

Browser acceptance should cover the admin panel's atomic save, create/cancel,
batch assignment, moves, unassignment, idea editing/deletion, stale revisions,
refresh persistence, mobile layouts, signed-out/non-admin rejection and public
data isolation. Use a disposable database copy for successful metadata writes;
do not change historical journal records to exercise the UI.

## Closed-trade reconciliation

Sync reconstructs complete one-way positions from stored execution fills,
including positions that opened and closed between account snapshots. It
requires every closing order and the full closed quantity in the exchange's
PnL records. Partial exits and adds remain in the same continuous position;
a full close followed by a re-entry creates a separate trade.

Closing-order IDs determine PnL ownership. A later exit for the same symbol
cannot extend an older reconciled trade. Existing canonical IDs, explicit
exclusions, base-R locks and published records remain intact. Multiple
opening orders still require owner attribution; missing fills, reversals,
hedge-mode ambiguity and incomplete PnL fail closed rather than being guessed.

A reconstruction does not approve publication or complete ASR. Run
`execution-rounds.test.ts` with the performance suite to cover re-entries,
partial closes, adds, duplicate fills, incomplete histories, alias handling
and exact closing-order/quantity checks.
