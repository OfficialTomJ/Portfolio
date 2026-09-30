# Performance Journal admin review

The public `/performance` route reads published closed trades only. The creator-only `/performance/review` route reads those same published results plus valid `pending_review` trade candidates for the account used by the latest successful sync. It recalculates the existing R metrics, calendar, and curve from that combined set. Attribution holds, excluded records, and unresolved records do not enter performance calculations.

Pending trade links open `/performance/review/trades/[id]`, which shares the public trade breakdown component but has no public metadata or social-image generation. Review pages return 404 without a verified, allowlisted admin session; they are marked noindex and no-store. There is no public journal link to review pages. The existing creator dashboard links to them after its own admin gate.

The active-position section contains only positions observed in the latest successful account snapshot. It shows no position size, monetary PnL, or unrealized R, and never contributes to closed-trade statistics.

`Sync now` sends an authenticated same-origin POST to the private admin endpoint. This invokes the same `syncPerformanceJournal` function and lock used by the workflow; it does not grant publication approval or expose the workflow secret to the browser. A concurrent sync reports that it is already running. Failed syncs leave the last successful view available.

The production `ADMIN_EMAILS` allowlist already controls the creator dashboard. The review route additionally requires the session email to be verified. Test the review route with real authentication in production or staging; the local development session helper intentionally substitutes a verified admin when dev bypass is enabled.
