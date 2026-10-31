# Performance Journal — staging review

31 October 2026. The original public layout with expandable ideas and historical trade
reconciliation are implemented for owner testing. Production is unchanged.

## Open

- [Public journal](https://mentor.stage.thomas-johnston.com/performance)
- [Private admin](https://mentor.stage.thomas-johnston.com/admin)
- [Complete example — public](https://mentor.stage.thomas-johnston.com/performance/ideas/idea-094c9f36-ed74-4317-9ed7-398e12828500)
- [Same example — admin](https://mentor.stage.thomas-johnston.com/admin?view=ideas&idea=idea-094c9f36-ed74-4317-9ed7-398e12828500)
- [Private ASR](https://mentor.stage.thomas-johnston.com/admin/asr)
- [Sign in](https://mentor.stage.thomas-johnston.com/sign-in), if required; use
  the existing verified admin account.

This deployment uses `blueprint_dev` and real authentication. Changes you make
here persist in development data. Existing rough ideas remain private drafts; none were automatically published.
A clearly labelled staging demonstration is the only new published idea. It shows
three labelled fictional sample trades on its detail page only. These never enter
the journal dataset, trade editor or performance totals.
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
4. The admin tabs are **Ideas**, **Trades**, **Publication & history**. Ideas opens
   by default. Select an existing rough idea or create a title-only draft. There
   is one title and one editor for thesis, target/scenario, invalidation, date and
   outcome. Chart levels, linked trades and additional context are expandable.
   Drafts remain private. Save, review and confirm publication when ready. A
   published idea can have saved unpublished edits; the public snapshot remains
   unchanged until republished. **Move to draft** withdraws the public narrative
   without changing closed trade results. Legacy private notes are preserved in
   storage and never copied into the public version. Public readiness requires
   thesis, target/scenario and invalidation; numeric levels are optional.
   Assign trades from their trade editor, then publish those assignments separately.
   The complete staging demonstration includes a thesis, confirmation conditions,
   targets, daily-close invalidation and reference market/levels.
   It is explicitly illustrative, with three separately labelled display-only sample trades on its public detail page.
   Use **1h**, **4h** and **Daily**, then **Locate on chart** on each sample trade
   to isolate entry/exit arrows. **Show all trades** restores grouped markers.
5. Open **Private ASR** at `/admin/asr`. Review a closed trade, save Expected R,
   validity and comments, and inspect the private paired comparison. This must not
   change actual R, the public record or unpublished-trade-change counts. If trade
   facts/risk are later corrected, the old assessment is flagged for reconfirmation.
6. Open **Trades → Import trades** for the Breakout CSV preview and selective import.
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

- 124 performance tests passed; four optional integration suites were skipped in
  the ordinary test run. The new reconciliation transaction suite ran separately
  and passed against a disposable localhost replica set.
- Transaction scenarios cover historical published corrections, incomplete legacy
  holds, archived editing, private save/publication separation, restore, retries,
  concurrent saves, Breakout conflicts/re-imports, changed source evidence, idea
  privacy, stable publication dates and preserved public assignments. Refinement
  checks cover dated update publication, separate ASR revisions, retry/stale-save
  protection, public invariance, and stale assessments after fact corrections.
  New checks cover title-only private drafts, publication readiness, and saving
  the same canonical title/content to idea selectors while retaining legacy notes.
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
- Latest staging verification confirmed tab order, imports inside Trades, one
  title/editor, and the complete example in public and admin. Reference candles
  loaded. Public and admin pages had no horizontal
  overflow at 375px. Authenticated/anonymous API checks passed. The example
  creation verified unchanged existing ideas, private rows and published trades.
  The latest UI simplification performs no idea or trade data migration.
- Latest simplification removes timeline editing/selection and all thesis markers,
  uses smaller headings/body text, puts one current thesis above the chart, and
  leaves execution detail with the trades. Chart overlay effects now update the
  existing series/marker plugin and do not recreate/fit the chart. The date window
  remains fixed while overlays are toggled. Prior timeline fields are retained
  in historical records; saving the single editor omits retired timeline fields.
  Hosted browser QA panned the chart away from its initial position, switched
  levels off/on and toggled trades, and confirmed the panned date range persisted.
  At 375px the page had no horizontal overflow (20px title, 13px thesis). Admin
  showed only current chart-level inputs, with no timeline editor. Hosted privacy
  checks passed again. No idea or trade records were changed for this refinement.
- Timeframe QA loaded 1h, 4h and Daily, confirmed the extra history and grouped
  daily markers, and isolated the later sample execution with entry/exit arrows.
  An hourly chart retained its panned date range after toggling levels off/on.
  At 375px all timeframe controls remained present with no horizontal overflow.
  Browser logs were clean. HTTP checks found all three samples on the example
  page and no sample IDs in the main journal. Production deployment was unchanged.
- The Chronicles invitation was verified to resolve to the intended server.

The current example has three display-only executions in
`blueprint_dev.performance_staging_idea_examples`. Only the idea detail loader
reads this collection. It requires the exact staging hostname, explicit
`blueprint_dev` database and a deployment that is not production. Sample fields
are validated and allowlisted. Existing trade records, assignments and journal
results are unchanged; the staging seed verified their before/after hashes. The
admin continues to show actual linked journal trades only.

No new production trades were imported or published. No real source history was
repaired as a browser test. Spot, scanner, the Discord/product signup redesign and
F&G scheduling remain parked/deferred as agreed.

## Deployment and recovery

- Staging deployment: `dpl_HuHb3QV8jn2QfjPZka6LMD55AipU`
- Immutable URL: `https://thomasjohnston-7uc0ppvj1-thomas-johnstons-projects-d78bf4d9.vercel.app`
- Previous staging deployment: `dpl_BnUpPcpAUACWfdRUjtpkygjmYntm`, at
  `https://thomasjohnston-owgch0aw4-thomas-johnstons-projects-d78bf4d9.vercel.app`
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
