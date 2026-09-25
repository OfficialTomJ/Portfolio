import { config } from "dotenv";
import type {
  PerformanceSnapshotBlobDocument,
  PerformanceSnapshotManifestDocument,
} from "./snapshot-archive";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

function requestedRunId(): string | undefined {
  const index = process.argv.indexOf("--run-id");
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const [{ getDb }, archive, validation, sync] = await Promise.all([
    import("@/lib/mongodb"),
    import("./snapshot-archive"),
    import("./sync-validation"),
    import("./sync"),
  ]);
  const db = getDb();
  const manifests = db.collection<PerformanceSnapshotManifestDocument>(
    sync.PERFORMANCE_COLLECTIONS.snapshotManifests
  );
  const blobs = db.collection<PerformanceSnapshotBlobDocument>(
    sync.PERFORMANCE_COLLECTIONS.snapshotBlobs
  );
  const runId = requestedRunId();
  const manifest = runId
    ? await manifests.findOne({ _id: runId })
    : await manifests.findOne({}, { sort: { receivedAt: -1 } });

  if (!manifest) throw new Error("No archived performance snapshot was found");

  const snapshot = await archive.loadPerformanceSnapshotArchive(
    manifest._id,
    blobs,
    manifests
  );
  if (!snapshot) throw new Error("Archived performance snapshot could not be reconstructed");
  if (manifest.validation.status === "accepted") {
    validation.assertValidPerformanceSnapshot(snapshot);
  }

  console.log(JSON.stringify({
    ok: true,
    runId: manifest._id,
    environment: manifest.environment,
    capturedAt: manifest.capturedAt.toISOString(),
    validation: manifest.validation.status,
    sections: Object.keys(manifest.sections).length,
    positions: snapshot.positions.length,
    executions: snapshot.executions.length,
    orders: snapshot.orders.length,
    openOrders: snapshot.openOrders.length,
    closedPnl: snapshot.closedPnl.length,
  }, null, 2));
  process.exit(0);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown snapshot verification error";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
