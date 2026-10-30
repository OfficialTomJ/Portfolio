import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const [command, tradeId, fingerprint] = process.argv.slice(2);
  if (command !== "list" && command !== "approve") {
    throw new Error("Usage: npm run performance:review -- list | approve <trade-id> <fingerprint>");
  }

  const { getDb, getMongoClient } = await import("../mongodb");
  const { getAdminPerformanceSnapshot } = await import("./admin-data");
  const { publishStoredTrade } = await import("./journal");
  if (command === "list") {
    const snapshot = await getAdminPerformanceSnapshot();
    if (!snapshot) throw new Error("Stored journal unavailable");
    console.log(JSON.stringify(snapshot.pendingReviews.map(item => ({ ...item, trade: snapshot.dataset.trades.find(trade => trade.id === item.id) })), null, 2));
    return;
  }

  if (!tradeId || !fingerprint) {
    throw new Error("Usage: npm run performance:review -- approve <trade-id> <fingerprint>");
  }
  if (!/^trade-[a-f0-9]{20}$/.test(tradeId) || !/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error("Invalid trade ID or fingerprint");
  await publishStoredTrade(getDb(), getMongoClient(), tradeId, fingerprint);
  const { publishCurrentPerformanceSocialImages } = await import("./social-image-publisher");
  try { await publishCurrentPerformanceSocialImages(); } catch { console.error("Image refresh needs retry; trade publication completed."); }
  console.log(JSON.stringify({ ok: true, publishedTradeId: tradeId }, null, 2));
}

void main().then(() => {
  process.exit(0);
}).catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown review error";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
