import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const { syncPerformanceJournal } = await import("./sync");

  try {
    const result = await syncPerformanceJournal();
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown performance sync error";
    console.error(JSON.stringify({ ok: false, error: message }));
    process.exit(1);
  }
}

void main();
