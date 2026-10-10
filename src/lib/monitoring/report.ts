import type { HealthResult } from "./policy";

type Fetcher = typeof fetch;

export async function reportHealth(pingUrl: string, result: HealthResult, fetcher: Fetcher = fetch): Promise<void> {
  const url = new URL(pingUrl);
  if (url.origin !== "https://hc-ping.com" || !/^\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(url.pathname) ||
    url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid Healthchecks ping URL");
  }
  // This is a health evaluation, not a producer-completion signal. Pending
  // images within their fixed publication allowance are operationally healthy;
  // preserve the waiting reason/counts rather than claim images were generated.
  const destination = `${pingUrl}${result.status === "failed" ? "/fail" : ""}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(destination, { method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: result.status, reason: result.reason, counts: result.counts }) });
      if (response.ok && (await response.text()).trim() === "OK") return;
    } catch { /* Bounded retries; do not print credentials or destination URLs. */ }
  }
  throw new Error("Healthchecks reporting failed");
}

export async function evaluateAndReport(name: string, check: () => Promise<HealthResult>, pingUrl: string | undefined,
  dryRun: boolean, fetcher: Fetcher = fetch): Promise<boolean> {
  let result: HealthResult;
  try { result = await check(); }
  catch { result = { status: "failed", reason: "health_evaluation_unavailable" }; }
  console.log(JSON.stringify({ service: name, ...result }));
  if (!dryRun) {
    if (!pingUrl) throw new Error(`Missing ping URL for ${name}`);
    await reportHealth(pingUrl, result, fetcher);
  }
  return result.status !== "failed";
}
