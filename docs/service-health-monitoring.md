# Healthchecks monitoring

The `Service health monitoring` GitHub workflow evaluates the live Performance
Journal every 15 minutes and sends sanitized results to Healthchecks.io. Email
notifications are configured in the owner's Healthchecks project. There is no
website dashboard and no application deployment is needed for this integration.

The evaluator reads existing MongoDB records and public PNG routes. It never runs
a trade sync, generates images, creates indexes, or changes service data. It uses
the repository's existing `GH_ACTION` database connection; a dedicated read-only
database credential can replace it later without changing the evaluator.

## Active checks

| Check | Required evidence |
| --- | --- |
| Trade sync | The state points to a succeeded, completed run for the configured environment and pinned account. Its capture and completion timestamps must both be within 45 minutes. |
| Trade SEO images | Every required public trade image and the current Sydney YTD journal image exists under the app's current fingerprint/renderer key and passes PNG/checksum validation. The public journal and one rotating trade PNG must return those same bytes. |

An empty or unchanged journal is valid. Private reviews, excluded trades, and
intentional publication holds are not missing public images. A running/skipped
invocation cannot refresh completed-sync evidence. Image failures do not conceal
a successful data sync.

Missing images receive 60 minutes from their durable public publication/update
timestamp; no-change syncs cannot reset it. Corrupt images fail immediately. During
that allowance, evaluation reports an explicit waiting reason and counts, keeping
the operational check up without claiming generation finished. Missing timestamps fail closed.

Both Healthchecks use a simple 15-minute period plus 30-minute grace. If the health
workflow itself stops completing, Healthchecks alerts after 45 minutes without a
successful evaluation. A stale completed trade sync sends an explicit failure
even when the health evaluator is still running. GitHub scheduling is best effort;
monitoring is intended to expose its delays rather than guarantee exact timing.

## Repository settings

| Setting | Type | Purpose |
| --- | --- | --- |
| `SERVICE_HEALTH_ENABLED` | Variable | Set `true` to enable scheduled/manual monitoring jobs. |
| `MONITOR_BYBIT_ENV` | Variable | Match the live source environment, currently `demo`. |
| `GH_ACTION` | Existing secret | MongoDB connection already used by the daily database refresh. |
| `MONITOR_PERFORMANCE_ACCOUNT_ID` | Secret | Pin health evidence to the currently connected account. |
| `HEALTHCHECKS_PERFORMANCE_SYNC_URL` | Secret | Private ping URL for production trade sync. |
| `HEALTHCHECKS_PERFORMANCE_IMAGES_URL` | Secret | Private ping URL for production image coverage. |

Ping URLs are credentials. Do not commit them, include them in workflow logs,
follow redirects when pinging, or paste them into shared documentation. The
reporter verifies Healthchecks returned the exact `OK` response, retries up to
three times with 10-second request limits, and sends only safe reason categories
and aggregate counts. Exceptions are sanitized before reporting.

Production monitoring explicitly requires `MONGODB_DB=blueprint_prod`. The job
does not read Bybit API credentials or private trade-review contents. Each service
is evaluated/reported independently: one broken check cannot hide another result.

## Testing and recovery

Run offline monitoring tests:

```sh
npx --no-install tsx --test src/lib/monitoring/monitoring.test.ts
```

With the matching database connection/environment set, inspect without pinging:

```sh
MONGODB_DB=blueprint_prod NODE_PATH=node_modules/next/dist/compiled \
  NODE_OPTIONS=--conditions=react-server \
  npx --no-install tsx src/lib/monitoring/cli.ts --dry-run
```

For `sync_overdue`, inspect `Performance journal sync` Actions history and run its
existing manual dispatch when appropriate. For `required_images_missing`, inspect
the image-generation logs and use the existing targeted image backfill against
the intended database. Integrity failures require reviewing the exact image;
monitoring never deletes or replaces archived images. A public-image failure may
be a deployment/routing issue even when the stored bytes are valid.

Pause scheduled evaluations by setting `SERVICE_HEALTH_ENABLED=false`. Pause the
two checks in Healthchecks too, or missing pings will appropriately create alerts.
Do not send fake success to silence an incident. Re-enable both sides and perform
one manual monitoring run before relying on scheduled results.

## Prepared checks for upcoming features

The owner's account also has separate paused checks for test F&G processing,
test F&G publication, test F&G Discord delivery, and pilot Chronicles invitations.
They have distinct URLs and email integrations, but this production workflow does
not ping them. Their existing feature schedules/deployments remain unchanged.

F&G activation requires the reviewed test schedule, durable completed-source-check
evidence, cross-day same-link preview acceptance, and an evaluator for actual
source/image/message outcomes. Invitation activation requires classified service
failure evidence and periodic read-only health evaluation; an idle signup form is
healthy, and Resend acceptance is not inbox delivery. Verification/paid-role checks
remain deferred to the current product scope.

These paused checks are preparation, not live coverage. Resume them only with
their corresponding feature rollout; never point a test check at production or
allow trial success to clear a production incident.

See [Healthchecks schedule configuration](https://healthchecks.io/docs/configuring_checks/)
and [email notifications](https://healthchecks.io/docs/configuring_notifications/).
