import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

async function main() {
  const { getCommunity } = await import("../src/lib/community/runtime");
  const { getMongoClient } = await import("../src/lib/mongodb");
  try {
    const { worker } = getCommunity();
    console.log(JSON.stringify(await worker.run(), null, 2));
  } finally { await getMongoClient().close(); }
}
main().catch(() => { console.error("Community processor failed. Check configuration and database/provider access."); process.exitCode = 1; });
