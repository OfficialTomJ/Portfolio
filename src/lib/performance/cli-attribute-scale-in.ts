import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const [symbol, stopValue] = process.argv.slice(2);
  const expectedStop = Number(stopValue);
  if (!symbol || !stopValue || !Number.isFinite(expectedStop)) {
    throw new Error("Usage: npm run performance:attribute-scale-in -- <SYMBOL> <EXPECTED_STOP>");
  }

  const { attributeSameTradeScaleIn, syncPerformanceJournal, PERFORMANCE_COLLECTIONS } = await import("./sync");
  const { getDb } = await import("@/lib/mongodb");
  await syncPerformanceJournal();
  const attribution = await attributeSameTradeScaleIn(symbol, expectedStop);
  await syncPerformanceJournal();
  const cycle = await getDb().collection<{
    _id: string;
    status: string;
    publicationHold?: boolean;
    sameTradeAttribution?: { invalidatedAt?: Date };
    initialStopPrice?: number;
  }>(PERFORMANCE_COLLECTIONS.positionCycles)
    .findOne({ _id: attribution.cycleId }, { projection: {
      status: 1, publicationHold: 1, sameTradeAttribution: 1, initialStopPrice: 1,
    } });
  if (cycle?.status !== "open" || cycle.publicationHold === true ||
      cycle.sameTradeAttribution?.invalidatedAt ||
      cycle.initialStopPrice !== expectedStop) {
    throw new Error("Attribution was recorded but the post-sync cycle is not clear for review");
  }
  console.log(JSON.stringify({
    ok: true,
    symbol: attribution.symbol,
    direction: attribution.direction,
    openingOrderCount: attribution.openingOrderCount,
    stopPrice: attribution.stopPrice,
    riskAtStopR: attribution.riskAtStopR,
    status: "open",
    publicationHold: false,
  }, null, 2));
}

void main().then(() => process.exit(0)).catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown attribution error";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
