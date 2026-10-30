import type { Metadata } from "next";
import { cache } from "react";
import ResultsJournal from "@/Components/performance/ResultsJournal";
import { getPublicIdeaViews } from "@/lib/performance/workspace-public";
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

export const dynamic = "force-dynamic";
export default async function PerformancePage() {
  const result = await getPerformancePageDataset();
  const dataset = result.dataset;
  const ideas = dataset ? await getPublicIdeaViews(dataset.trades) : [];
  return <main className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6 sm:pt-7">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-2"><h1 className="text-lg font-medium tracking-tight text-zinc-200 sm:text-xl">Performance Journal<span className="text-[#ff8b52]">.</span></h1><span className="text-[10px] text-zinc-600">Thomas Johnston · Results & ideas</span></header>
    {dataset ? <ResultsJournal dataset={dataset} ideas={ideas}/> : <PerformanceUnavailable/>}
  </main>;
}
