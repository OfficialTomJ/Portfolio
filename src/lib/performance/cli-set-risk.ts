import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const amount = Number(argument("--amount"));
  const effectiveFrom = new Date(argument("--effective-from") ?? "");
  const reason = argument("--reason") ?? "Risk configuration update";

  if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(effectiveFrom.getTime())) {
    throw new Error(
      "Usage: npm run performance:risk:set -- --amount 1000 --effective-from 2026-09-01T00:00:00.000Z [--reason description]"
    );
  }

  const { setPerformanceRiskVersion } = await import("./sync");
  const version = await setPerformanceRiskVersion({
    riskAmount: amount,
    effectiveFrom,
    reason,
  });
  console.log(JSON.stringify({
    ok: true,
    version: version.version,
    riskAmount: version.riskAmount,
    currency: version.currency,
    effectiveFrom: version.effectiveFrom.toISOString(),
  }, null, 2));
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown risk configuration error";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
