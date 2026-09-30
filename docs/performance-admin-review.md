# Performance Journal admin review

The public `/performance` route reads published closed trades only. The creator-only `/performance/review` route reads those same published results plus valid `pending_review` trade candidates for the account used by the latest successful sync. It recalculates the existing R metrics, calendar, and curve from that combined set. Attribution holds, excluded records, and unresolved records do not enter performance calculations.

Pending trade links open `/performance/review/trades/[id]`, which shares the public trade breakdown component but has no public metadata or social-image generation. Review pages return 404 without a verified, allowlisted admin session; they are marked noindex and no-store. There is no public journal link to review pages. The existing creator dashboard links to them after its own admin gate.

The active-position section contains only positions observed in the latest successful account snapshot. It shows no position size, monetary PnL, or unrealized R, and never contributes to closed-trade statistics.

`Sync now` sends an authenticated same-origin POST to the private admin endpoint. This invokes the same `syncPerformanceJournal` function and lock used by the workflow; it does not grant publication approval or expose the workflow secret to the browser. A concurrent sync reports that it is already running. Failed syncs leave the last successful view available.

Each pending closed-trade row has an admin-only checkmark. It asks for confirmation, then posts that trade's exact review fingerprint to a verified-admin, same-origin endpoint. The endpoint approves only a matching pending candidate and runs the normal sync to validate and publish it, including the usual social-image process. A changed candidate, attribution hold, exclusion, or failed safety check cannot be published by the checkmark. Other pending trades remain pending. The public journal has no publish controls, and no reject action is needed. If the post-approval sync cannot complete, the UI reports that approval was recorded but publication was not confirmed; a later successful sync may finish it.

The production `ADMIN_EMAILS` allowlist already controls the creator dashboard. The review route additionally requires the session email to be verified. Test the review route with real authentication in production or staging; the local development session helper intentionally substitutes a verified admin when dev bypass is enabled.
