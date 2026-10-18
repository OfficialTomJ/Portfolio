import { notFound } from "next/navigation";
import PerformanceDashboard from "@/Components/performance/PerformanceDashboard";
import AsrComparison from "@/Components/performance/AsrComparison";
import { buildPerformanceView } from "@/lib/performance/metrics";
import { riskPreviewDataset, riskPreviewEnabled } from "@/lib/performance/risk-preview";
import { EMPTY_ANNOTATION } from "@/lib/performance/annotations-model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Risk change — synthetic staging preview", robots: { index: false, follow: false } };

/** Synthetic preview only: no database or broker reads/writes, never available in production. */
export default async function RiskPreviewPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  if (!riskPreviewEnabled()) notFound();
  const { scenario } = await searchParams;
  const dataset = riskPreviewDataset(scenario);
  const annotations = Object.fromEntries(dataset.trades.map(t => [t.id, { ...EMPTY_ANNOTATION, expectedR: t.resultR + 0.1, valid: true }]));
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"><h1 className="font-semibold">Risk-change staging demonstration</h1><p className="mt-2">Synthetic example data only. No prop accounts or production data are changed.</p><nav className="mt-3 flex gap-4"><a className="underline" href="?scenario=standard">Across the change</a><a className="underline" href="?scenario=gap">Paused after change</a><a className="underline" href="?scenario=future">Future change hidden</a><a className="underline" href={`/api/performance/risk-preview/og?scenario=${scenario ?? "standard"}`}>Preview share image</a></nav></div>
    <PerformanceDashboard dataset={dataset} />
    <AsrComparison view={buildPerformanceView(dataset, "YTD", 2026)} annotations={annotations} />
  </main>;
}
