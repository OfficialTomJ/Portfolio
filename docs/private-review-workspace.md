# Private review workspace

## Purpose and scope

The creator's private journal supports performance analysis and Advanced Self Review without confusing review completion with approval for public publication. Existing data is sufficient; this change adds no stored review fields, strategy comparison, automated assessment, ingestion changes or automatic publication. Public journal and trade layouts remain unchanged.

## Expected workflow

One performance card contains period/type/strategy filters, actual metrics and the chart. Defaults remain All actual results and rolling 30 days. ASR comparison is opt-in; actual R, expected R and gap use identical reviewed trades, dates and validity selection, with explicit coverage and independent curve toggles.

The review queue defaults to Needs ASR, including incomplete drafts and published trades with missing reviews. Reviewed, All closed and Active are separate views; publication is an independent All/Unpublished/Published filter. Closed rows expose actual R, expected R, gap and validity. Missing assessments are not treated as zero. Active positions never contribute to results or receive ASR.

Private trade pages show the price chart beside an inline review form on desktop and above it on mobile. ASR is first, classification/notes/public description are secondary. Forms open from authenticated page data, never replace an edited draft on background refresh, retain revision-conflict protection and transactional audit history, and guard unsaved drafts on link navigation/unload. Saving is not publication. Save and next unreviewed requires a complete ASR and a successful save before navigating to another eligible account-scoped closed trade, across all periods.

Use compact review/publication progress instead of the explanatory banner. Sync times stay GMT. Global outstanding counts are clearly labelled; chart and queue counts follow the selected period and classification filters.

## Verification and rollout

Unit-test independent review/publication filtering, incomplete/zero/invalid assessments, non-mutating selection and next-trade boundaries. Browser-test actual/ASR subsets, filters, editor save/refresh/conflicts, draft discard, next navigation, last-trade state, active restrictions and layouts at 320/375/768/1024/1280px. Check public HTML/RSC and images for private fields and signed-out admin access rejection. Dev-only fixtures are restored, source results and publication records remain unchanged, and no test publishes or syncs trades. Preview uses blueprint_dev; production remains untouched until separately approved.
