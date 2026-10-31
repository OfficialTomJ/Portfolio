# Performance Journal — staging review

31 October 2026. The original public layout with expandable ideas and historical trade
reconciliation are implemented for owner testing. Production is unchanged.

## Open

- [Public journal](https://mentor.stage.thomas-johnston.com/performance)
- [Private admin](https://mentor.stage.thomas-johnston.com/admin)
- [Private ASR](https://mentor.stage.thomas-johnston.com/admin/asr)
- [Sign in](https://mentor.stage.thomas-johnston.com/sign-in), if required; use
  the existing verified admin account.

This deployment uses `blueprint_dev` and real authentication. Changes you make
here persist in development data. Public idea drafts are deliberately empty until
you prepare them; existing private ideas and notes were not automatically published.
The earlier combined/Spot mock has been replaced on the staging alias only.

## Suggested test

1. Check the public journal on desktop and phone. The original results/statistics,
   chart and visible calendar are restored. It defaults to 30 days; try periods,
   custom dates, Day/Swing filters and calendar-day selection. **By idea** gives
   compact summaries that expand into context and linked trades; **All trades**
   keeps the flat newest-first record. Idea results follow the selected period,
   type and day. Unlinked trades remain accessible. Until an idea is explicitly
   published, the list defaults to **All trades**. Full thesis, scenario and
   invalidation live on the idea page, keeping the main record compact.
2. In admin **Trades**, open both a historical Bybit trade and a Breakout trade.
   Change entry/exit, timestamps, actual net R, private risk, idea, classification
   or private reconciliation notes. ASR is on its own private page. Add a reason and **Save private changes**. Refresh/reopen to
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
   Use the publication filter and public/draft revision labels to see what is live.
   Rough private notes need no numeric chart or timeline. Public readiness asks for
   thesis, target/scenario and invalidation text. Optional market levels and dated
   updates appear on the idea chart, one market at a time with layer controls and
   trade focus. Updates retain actual first-publication dates. Only fictional
   local data was published to test this; existing real ideas remain private.
5. Open **Private ASR** at `/admin/asr`. Review a closed trade, save Expected R,
   validity and comments, and inspect the private paired comparison. This must not
   change actual R, the public record or unpublished-trade-change counts. If trade
   facts/risk are later corrected, the old assessment is flagged for reconfirmation.
6. Use **Imports** for the existing Breakout CSV preview and selective import.
   Confirming an import remains separate from source activation and publication.
   Held rows can now be opened in the same reconciliation editor.
7. Use **Publication & history** to inspect saved revisions. **Restore draft**
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

- 115 performance tests passed; four optional integration suites were skipped in
  the ordinary test run. The new reconciliation transaction suite ran separately
  and passed against a disposable localhost replica set.
- Transaction scenarios cover historical published corrections, incomplete legacy
  holds, archived editing, private save/publication separation, restore, retries,
  concurrent saves, Breakout conflicts/re-imports, changed source evidence, idea
  privacy, stable publication dates and preserved public assignments. Refinement
  checks cover dated update publication, separate ASR revisions, retry/stale-save
  protection, public invariance, and stale assessments after fact corrections.
- TypeScript and targeted ESLint passed. The hosted Next.js production build
  reached READY for this preview deployment.
- Local HTTP checks used real signed-in authentication with development bypass
  disabled. Hosted checks verified the public page, authenticated admin, existing
  historical records, anonymous rejection, foreign-origin rejection, malformed
  command rejection and public/private data separation.
- Browser checks covered historical correction and publication, idea drafting and
  publication, linked idea results, desktop, 375 × 812 and 320 × 568 layouts.
  The restored public layout was checked separately with long fictional public
  ideas, expansion, day filtering, flat/grouped views and narrow mobile widths.
- Hosted browser checks opened the real staging public page, existing admin
  history, historical Bybit editor and existing private idea catalogue without
  modifying their trade or idea data. Successful mutation QA used disposable,
  fictional local data.
- The Chronicles invitation was verified to resolve to the intended server.

No new production trades were imported or published. No real source history was
repaired as a browser test. Spot, scanner, the Discord/product signup redesign and
F&G scheduling remain parked/deferred as agreed.

## Deployment and recovery

- Staging deployment: `dpl_513KNtSEPH5919XComMthxqXC3ie`
- Immutable URL: `https://thomasjohnston-9ie22u3yt-thomas-johnstons-projects-d78bf4d9.vercel.app`
- Previous staging deployment: `dpl_FS7C8CCSrfAzzh2N6yGzKMY4s2bh`, at
  `https://thomasjohnston-g40etdkqz-thomas-johnstons-projects-d78bf4d9.vercel.app`
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
