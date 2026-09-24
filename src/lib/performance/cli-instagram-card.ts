import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const tradeId = argument("--trade");
  if (!tradeId) {
    throw new Error("Usage: npm run performance:instagram -- --trade <closed-trade-id> [--out <png-path>]");
  }

  const [{ getLivePerformanceTrade }, { getHistoricalCandles }, card] = await Promise.all([
    import("./data"),
    import("./market"),
    import("./instagram-card"),
  ]);
  const result = await getLivePerformanceTrade(tradeId);
  if (result.status === "unavailable") throw new Error("The performance database is unavailable");
  if (result.status === "not-found") throw new Error(`Closed trade not found: ${tradeId}`);

  const market = await getHistoricalCandles(result.trade, "1h", 12);
  if (!market) throw new Error("Neither market source returned candles for this trade");

  const requestedOutput = argument("--out");
  const outputPath = resolve(
    requestedOutput ?? `output/social/${card.defaultInstagramCardFilename(result.trade)}`
  );
  await card.renderInstagramTradeCard({
    trade: result.trade,
    candles: market.candles,
    source: market.source,
    outputPath,
  });

  console.log(JSON.stringify({
    ok: true,
    tradeId: result.trade.id,
    symbol: result.trade.symbol,
    source: market.source,
    dimensions: "1080x1350",
    outputPath,
  }, null, 2));
  process.exit(0);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown Instagram card error";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
