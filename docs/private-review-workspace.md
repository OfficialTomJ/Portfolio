# Private review workspace

## Purpose and scope

The creator's private journal supports performance analysis and Advanced Self Review without confusing review completion with approval for public publication. Existing data is sufficient; this change adds no stored review fields, strategy comparison, automated assessment, ingestion changes or automatic publication. Public journal and trade layouts remain unchanged.

## Expected workflow

One performance card contains period/type/strategy filters, actual metrics and the chart. Defaults remain All actual results and rolling 30 days. ASR comparison is opt-in; actual R, expected R and gap use identical reviewed trades, dates and validity selection, with explicit coverage and independent curve toggles.

The review queue defaults to Needs ASR, including incomplete drafts and published trades with missing reviews. Reviewed, All closed and Active are separate views; publication is an independent All/Unpublished/Published filter. Closed rows expose actual R, expected R, gap and validity. Missing assessments are not treated as zero. Active positions never contribute to results or receive ASR.

Reconciliation is an admin-only, read-only view of held or unresolved account-scoped records. It spans all history regardless of the chart's period/classification filters, supports asset search, and shows direction, opened/closed/recorded GMT times and a safe reason summary. It exposes no editing, publication or trade-detail actions and does not contribute to either results curve. Reconciled closed records still require separate manual publication approval.

Private trade pages show a full-width price chart above the inline review form at every breakpoint. ASR is first, classification/notes/public description are secondary. Forms open from authenticated page data, never replace an edited draft on background refresh, retain revision-conflict protection and transactional audit history, and guard unsaved drafts on link navigation/unload. Saving is not publication. Save and next unreviewed requires a complete ASR and a successful save before navigating to another eligible account-scoped closed trade, across all periods.

Desktop closed rows reserve identical result and action columns regardless of publication status; smaller screens retain labelled stacked cards. Quick Publish and the editor's separate Publication section share a confirmation with asset, direction, closed GMT time, actual R, public type and description only. Private ASR, strategies and notes are not part of the public preview. Unsaved edits disable editor publication until a separate Save succeeds; a modal stays open after saving. Neither Save nor Save and next can call publication. Active positions cannot publish, and ASR completion is independent of publication. Existing admin, same-origin, candidate-fingerprint, hold and ingestion checks are retained. Only explicit server confirmation shows Published; uncertain/changed outcomes require a fresh status check rather than an immediate retry.

Use compact review/publication progress instead of the explanatory banner. Sync times stay GMT. Global outstanding counts are clearly labelled; chart and queue counts follow the selected period and classification filters.

## Verification and rollout

Unit-test independent review/publication filtering, incomplete/zero/invalid assessments, non-mutating selection, next-trade boundaries and publication confirmation/error interpretation. Browser-test actual/ASR subsets, filters, editor save/refresh/conflicts, draft discard, next navigation, separate publication, cancel/error/double-submit handling, active restrictions and layouts at 320/375/768/1024/1280px. Check public HTML/RSC and images for private fields and signed-out admin access rejection. Dev-only review fixtures are restored; publication HTTP success/failure responses are intercepted to avoid broker syncs or publishing copied real trades. Preview uses blueprint_dev; production data remains untouched.
