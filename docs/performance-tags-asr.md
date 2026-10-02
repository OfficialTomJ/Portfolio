# Trade metadata and Advanced Self Review

The private journal at `/performance/review` provides trade management, reusable tags, public descriptions, private notes, and ASR. Edit trade opens the same editor from the list or a private trade detail. Active positions accept tags, descriptions, and notes; ASR becomes editable after closure. Saving never records publication approval.

ASR contains private comments, optional expected R on the trade's locked 1R basis, and a nullable valid/invalid assessment. Both expected R and validity are required for a completed review. Zero expected R and an invalid assessment are valid completed inputs. The private comparison pairs actual and expected results from the same completed reviews, with independent visibility controls and a shared scale. Period, tag, and validity filters operate on both curves. Actual source results remain immutable. The public journal defaults to 30 rolling days and filters published actual results by tag.

## Storage and privacy

- `performance_tag_catalogue`: reusable names with deterministic IDs from normalized names.
- `performance_trade_metadata`: public tag IDs and description only, keyed by stable trade ID.
- `performance_private_reviews`: notes, ASR, revision, editor, and edit timestamp.
- `performance_private_review_history`: immutable before/after records for each saved revision.

Public loaders read only public metadata and the assigned catalogue entries. They never query private review records. Public trade projections, social images, and source approval fingerprints exclude ASR. Plain-text content is rendered through React escaping. Saving metadata atomically updates both metadata records and audit history in a MongoDB transaction. A revision mismatch returns 409 and asks the editor to reload, preserving the saved version.

The existing verified-admin gate protects both read and write endpoints. Writes additionally require the request origin to match. Responses are private/no-store and noindex. Production uses `blueprint_prod`; preview/local development uses `blueprint_dev`. The daily prod-to-dev restore copies these collections once they exist in production, replacing their dev records. Dev-only collections absent from the production dump can persist until their first production use. Treat preview edits as test data, not durable reviews.

Metadata survives sync because the ingestion workflow owns separate collections. An active cycle's future trade ID is derived from the cycle ID, so its metadata carries through closure and publication. Tag saving does not invoke a sync. Publication remains a distinct, fingerprint-checked action.

## Verification

Test normalized tag reuse, negative/zero expected R, incomplete review coverage, paired dates, validity filtering, revision conflicts, and persistence through refresh. Check the signed-out private routes and API endpoints return 404, and inspect public HTML/RSC and image responses for private field leakage. Verify small-phone and desktop editing, native-dialog focus, keyboard scrolling, and chart toggles. Existing historical trades require no migration.
