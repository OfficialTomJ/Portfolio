import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const [command, tradeId, fingerprint] = process.argv.slice(2);
  if (command !== "list" && command !== "approve") {
    throw new Error("Usage: npm run performance:review -- list | approve <trade-id> <fingerprint>");
  }

  const {
    approvePerformanceReviewCandidate,
    isPerformanceReviewPublished,
    listPerformanceReviewCandidates,
    syncPerformanceJournal,
  } = await import("./sync");

  // Refresh the private source records before presenting or approving a candidate.
  await syncPerformanceJournal();
  if (command === "list") {
    console.log(JSON.stringify(await listPerformanceReviewCandidates(), null, 2));
    return;
  }

  if (!tradeId || !fingerprint) {
    throw new Error("Usage: npm run performance:review -- approve <trade-id> <fingerprint>");
  }
  await approvePerformanceReviewCandidate(tradeId, fingerprint);
  await syncPerformanceJournal();
  if (!await isPerformanceReviewPublished(tradeId)) {
    throw new Error("Approval was recorded, but the result remains private. Review the latest candidate.");
  }
  console.log(JSON.stringify({ ok: true, publishedTradeId: tradeId }, null, 2));
}

void main().then(() => {
  process.exit(0);
}).catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown review error";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
