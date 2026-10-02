import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
async function main() {
  const apply = process.argv.includes("--apply");
  const db = process.env.MONGODB_DB;
  if (db !== "blueprint_dev" && db !== "blueprint_prod") throw new Error("Explicit development or production database required");
  if (apply && db === "blueprint_prod" && !process.argv.includes("--confirm-production")) throw new Error("Production migration requires explicit confirmation");
  const { migrateTradeTags } = await import("./metadata-migration");
  const { getMongoClient } = await import("@/lib/mongodb");
  try { console.log(JSON.stringify({ database: db, ...await migrateTradeTags(apply) })); }
  finally { await getMongoClient().close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Metadata migration failed"); process.exitCode = 1; });
