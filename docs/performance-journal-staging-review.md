# Performance Journal — staging review

31 October 2026. The results-first journal, public ideas and historical trade
reconciliation are implemented for owner testing. Production is unchanged.

## Open

- [Public journal](https://mentor.stage.thomas-johnston.com/performance)
- [Private admin](https://mentor.stage.thomas-johnston.com/performance/review)
- [Sign in](https://mentor.stage.thomas-johnston.com/sign-in), if required; use
  the existing verified admin account.

This deployment uses `blueprint_dev` and real authentication. Changes you make
here persist in development data. Public idea drafts are deliberately empty until
you prepare them; existing private ideas and notes were not automatically published.
The earlier combined/Spot mock has been replaced on the staging alias only.

## Suggested test

1. Check the public journal on desktop and phone. It defaults to 30 days; try YTD,
   All, custom dates, asset search, Day/Swing filters and the expandable calendar.
   List filters are labelled separately from the headline/chart's period.
2. In admin **Trades**, open both a historical Bybit trade and a Breakout trade.
   Change entry/exit, timestamps, actual net R, private risk, idea, classification
   or review notes. Add a reason and **Save private changes**. Refresh/reopen to
   check persistence. This does not update the public result.
3. Choose **Review publication** or **Review public update**. Inspect the public
   before/after values and affected idea totals, then confirm if desired. Open
   the public journal/trade page to inspect the published version. Newly generated
   social images use the corrected fact fingerprint; existing image URLs remain.
4. Use **Ideas** to select an existing idea or create one. Expand **Private working
   idea** to maintain private content. Prepare a separate public title/thesis,
   scenario, invalidation, date, status and optional article link. Save the public
   draft, review it and confirm publication. Assign a trade from its trade editor
   and publish that assignment to link it publicly. Public idea results count
   only its published closed trades; private/held positions remain undisclosed.
5. Use **Imports** for the existing Breakout CSV preview and selective import.
   Confirming an import remains separate from source activation and publication.
   Held rows can now be opened in the same reconciliation editor.
6. Use **Publication & history** to inspect saved revisions. **Restore draft**
   creates a new private revision; publishing the restored version is separate.

Archived Bybit history is editable with the same tools. Its source boundary keeps
it out of results for the period supplied by Breakout; saving an archived edit
does not reactivate it. A known duplicate cannot be included alongside its canonical
record. Original source evidence stays available in the editor and database.

When later source evidence changes, saved corrected values are retained but private
inclusion is held for review. The admin flags the change and requires a fresh
decision before another publication. Existing published facts remain active until
an explicit update. Stale edits fail without silently overwriting another tab.

## Verified

- 105 performance tests passed; four optional integration suites were skipped in
  the ordinary test run. The new reconciliation transaction suite ran separately
  and passed against a disposable localhost replica set.
- Transaction scenarios cover historical published corrections, incomplete legacy
  holds, archived editing, private save/publication separation, restore, retries,
  concurrent saves, Breakout conflicts/re-imports, changed source evidence, idea
  privacy, stable publication dates and preserved public assignments.
- TypeScript and targeted ESLint passed. The hosted Next.js production build
  reached READY for this preview deployment.
- Local HTTP checks used real signed-in authentication with development bypass
  disabled. Hosted checks verified the public page, authenticated admin, existing
  historical records, anonymous rejection, foreign-origin rejection, malformed
  command rejection and public/private data separation.
- Browser checks covered historical correction and publication, idea drafting and
  publication, linked idea results, desktop, 375 × 812 and 320 × 568 layouts.
  The result/chart/CTA fit at 1280 × 800 and 375 × 812 without page overflow.
- Hosted browser checks opened the real staging public page, existing admin
  history, historical Bybit editor and existing private idea catalogue without
  modifying their trade or idea data. Successful mutation QA used disposable,
  fictional local data.
- The Chronicles invitation was verified to resolve to the intended server.

No new production trades were imported or published. No real source history was
repaired as a browser test. Spot, scanner, the Discord/product signup redesign and
F&G scheduling remain parked/deferred as agreed.

## Deployment and recovery

- Staging deployment: `dpl_7mD317dVQM56wo9FQdoHZQt62Qax`
- Immutable URL: `https://thomasjohnston-h0ki2hoip-thomas-johnstons-projects-d78bf4d9.vercel.app`
- Previous staging deployment: `dpl_6aa1rxAiXDbPBpcU1YTNm79r37HW`, at
  `https://thomasjohnston-8ubzzf7i9-thomas-johnstons-projects-d78bf4d9.vercel.app`
- Production remained on `dpl_EZk7DjRs36L5Ls4Ktt1huTMkHdAe` before and after the
  staging alias change.

Code rollback reassigns the staging alias to the previous staging deployment.
Correction restoration creates a new audited private draft; it does not erase raw
sources or earlier publication events. New state lives in dedicated reconciliation,
publication and idea-publication collections alongside the existing journal data.
No migration of production records or reactivation of Bybit ingestion is required
to review this build.

The initial Breakout schema still supports one explicit account. Advanced
split/merge and creation of entirely missing source positions remain follow-ups,
as scoped in the [approved plan](performance-journal-next-plan.md).
