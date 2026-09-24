# Persistent Performance Journal social images

Performance Journal sharing images are rendered once and stored as immutable PNG documents in MongoDB. Discord and other crawlers receive a stable, versioned URL instead of depending on a chart being rebuilt when the link is unfurled.

## Storage model

The `performance_public_social_images` collection stores:

- the PNG as MongoDB binary data;
- a SHA-256 checksum and byte length for integrity verification;
- image dimensions, content type, schema version and renderer version;
- the public trade or journal subject;
- aliases for the previous trade and journal image routes.

There is no TTL and existing image bytes are never overwritten. A corrected trade, changed journal result or renderer update creates a new versioned document and URL. Trade charts use Binance candles when available and Bybit public linear candles otherwise; the selected source is shown on the card and stored with the image. A trade image is not stored if neither source has usable candles, allowing a later retry to recover instead of preserving an incomplete chart. The public image endpoint only accepts a bounded safe key and serves a verified PNG with a one-year immutable cache policy.

The image reader supports both renderer versions 1 and 2, so older immutable URLs continue to serve their original PNGs after the new renderer is deployed.

## Environment isolation

No database name is hard-coded in the image code. It uses the existing `getDb()` connection and therefore follows `MONGODB_DB` exactly:

| Runtime | `MONGODB_DB` | Reads and writes |
| --- | --- | --- |
| Vercel production | `blueprint_prod` | Production trades and production images |
| Local development | `blueprint_dev` | Development trades and development images |
| Vercel preview | `blueprint_dev` | Development trades and development images |

The daily `Sync prod DB to dev` GitHub Action copies every non-excluded `blueprint_prod.*` collection into `blueprint_dev.*`. The image collection is not excluded, so the dev copy receives the exact production image history as part of that restore. The restore uses `--drop`, making production the source of truth for the next daily dev refresh.

Do not point a preview or local session at `blueprint_prod`. Do not run a production backfill unless `MONGODB_DB=blueprint_prod` has been explicitly selected.

## Generation lifecycle

1. The Bybit journal sync validates and publishes the trade data.
2. After the journal sync is marked successful, image publication renders any missing trade image and the current YTD journal image.
3. Image publication is fail-safe. A rendering or storage error is logged but cannot roll back or mark the journal data sync as failed.
4. Page metadata uses the immutable stored URL. If storage is temporarily unavailable, it falls back to the previous dynamic image route so the page remains available.
5. The previous image routes resolve stored aliases first, preserving links already posted before this change.

## Backfill

The command reads and writes only the database selected by `MONGODB_DB`:

```bash
MONGODB_DB=blueprint_prod npm run performance:images:backfill
```

For an immediate dev-only backfill:

```bash
MONGODB_DB=blueprint_dev npm run performance:images:backfill
```

Normally, production should be backfilled first and the daily prod-to-dev workflow should be allowed to copy the resulting collection. Running the dev command is useful when a preview must be tested before the next scheduled copy.

The command is idempotent. Existing versioned images are verified and reused; only missing images are generated.

## Recovery

If an image document fails checksum or PNG validation, the public endpoint returns an unavailable response rather than serving corrupt bytes. Because image documents are immutable and the journal trade source remains separate, a broken image can be deleted by exact `_id` and regenerated with the backfill command. Never delete the whole collection as part of normal recovery.
