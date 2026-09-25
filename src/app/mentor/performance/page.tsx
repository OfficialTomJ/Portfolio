import type { Metadata } from "next";
import { cache } from "react";
import PerformanceDashboard from "@/Components/performance/PerformanceDashboard";
import PerformanceUnavailable from "@/Components/performance/PerformanceUnavailable";
import { getLivePerformanceDataset } from "@/lib/performance/data";
import { buildPerformanceView, sydneyYear } from "@/lib/performance/metrics";
import { performanceOpenGraphAlt } from "@/lib/performance/og";
import {
  legacyJournalImageVersion,
  socialImagePath,
} from "@/lib/performance/social-image-keys";
import { ensureJournalSocialImage } from "@/lib/performance/social-images";
import { siteOrigin } from "@/lib/site-origin";

const pageTitle = "Performance Journal | Thomas Johnston";
const pageDescription = "A public journal of completed leverage and prop strategy trades, measured in R after positions close.";
const getPerformancePageDataset = cache(getLivePerformanceDataset);

export async function generateMetadata(): Promise<Metadata> {
  const result = await getPerformancePageDataset();
  const canonical = "https://mentor.thomas-johnston.com/performance";
  const view = result.dataset
    ? buildPerformanceView(result.dataset, "YTD", sydneyYear(result.dataset.asOf))
    : null;
  let image = `${siteOrigin()}/api/performance/og?v=latest`;
  if (result.dataset && view) {
    const legacyVersion = encodeURIComponent(legacyJournalImageVersion(view));
    image = `${siteOrigin()}/api/performance/og?v=${legacyVersion}`;
    try {
      const stored = await ensureJournalSocialImage(result.dataset, view);
      image = `${siteOrigin()}${socialImagePath(stored.publicKey)}`;
    } catch (error) {
      console.error("[performance/metadata] failed to prepare journal image", error);
    }
  }
  const alt = result.dataset && view
    ? performanceOpenGraphAlt(result.dataset, view)
    : "Thomas Johnston Performance Journal, completed strategy-trade results measured in R.";
  const images = [{ url: image, width: 1200, height: 630, alt }];

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: pageTitle,
      description: pageDescription,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      images,
    },
  };
}

const updatedFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Etc/UTC",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const result = await getPerformancePageDataset();
  const dataset = result.dataset;
  const tradeLabel = dataset
    ? `${dataset.trades.length} closed trade${dataset.trades.length === 1 ? "" : "s"}`
    : null;

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-12 sm:pb-16">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 sm:pb-7 sm:pt-10">
          <h1 className="break-words text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
            Performance Journal
          </h1>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            <p className="break-words text-base leading-6 text-zinc-300 sm:text-lg">
              Closed strategy trades, measured in R.
            </p>
            <p className="text-xs leading-5 text-zinc-500">
              {dataset && tradeLabel
                ? `${tradeLabel} · Updated ${updatedFormatter.format(new Date(dataset.asOf))} GMT`
                : "Performance figures are temporarily unavailable"}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-6">
        {dataset ? (
          <PerformanceDashboard dataset={dataset} />
        ) : (
          <PerformanceUnavailable />
        )}
      </section>

      <section className="mx-auto mt-8 max-w-7xl px-4 sm:mt-10 sm:px-6">
        <div className="border-t border-white/[0.07] pt-6 sm:flex sm:items-start sm:justify-between sm:gap-10">
          <div>
            <h2 className="text-sm font-medium text-zinc-300">About this record</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-600 sm:text-sm sm:leading-6">
              This journal records completed leverage and prop strategy trades, not every account order. Active positions, signals, strategy rules, position sizing and dollar returns are not shown.
            </p>
          </div>
          <p className="mt-3 max-w-md text-xs leading-5 text-zinc-600 sm:mt-0 sm:text-right">
            Recorded in a simulated trading environment connected to prop accounts. Past results do not promise future performance.
          </p>
        </div>
      </section>
    </main>
  );
}
