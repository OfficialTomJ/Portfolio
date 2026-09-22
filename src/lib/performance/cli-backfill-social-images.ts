import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const { publishCurrentPerformanceSocialImages } = await import("./social-image-publisher");
  const result = await publishCurrentPerformanceSocialImages();
  console.log(JSON.stringify({ ok: result.failures.length === 0, ...result }, null, 2));
  process.exit(result.failures.length === 0 ? 0 : 1);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown image backfill error";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
