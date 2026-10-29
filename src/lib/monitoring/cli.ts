import "server-only";
import { getMongoClient } from "../mongodb";
import { checkPerformanceImages } from "./performance";
import { evaluateAndReport } from "./report";

async function main() {
  if (process.env.MONGODB_DB !== "blueprint_prod") throw new Error("Production monitoring must select blueprint_prod explicitly");
  const dryRun = process.argv.includes("--dry-run");
  console.log(JSON.stringify({ service: "performance-source", status: "retired", reason: "bybit_replaced_by_manual_csv_imports" }));
  const results = await Promise.allSettled([
    evaluateAndReport("performance-images", () => checkPerformanceImages(process.env.MONITOR_PERFORMANCE_ORIGIN ?? "https://mentor.thomas-johnston.com"),
      process.env.HEALTHCHECKS_PERFORMANCE_IMAGES_URL, dryRun),
  ]);
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") console.error(`Monitoring result ${index + 1} could not be reported.`);
  }
  if (results.some(result => result.status === "rejected" || !result.value)) process.exitCode = 1;
}

main().catch(() => { console.error("Monitoring configuration is unavailable."); process.exitCode = 1; })
  .finally(async () => { try { await getMongoClient().close(); } catch { /* No connection to close. */ } });
