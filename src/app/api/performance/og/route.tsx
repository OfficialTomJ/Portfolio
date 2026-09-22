import { ImageResponse } from "next/og";
import { getLivePerformanceDataset } from "@/lib/performance/data";
import { buildPerformanceView, sydneyYear } from "@/lib/performance/metrics";
import { PerformanceOpenGraphCard } from "@/lib/performance/og";
import {
  journalLegacyImageKey,
  legacyJournalImageVersion,
} from "@/lib/performance/social-image-keys";
import {
  ensureJournalSocialImage,
  loadStoredSocialImage,
  loadStoredSocialImageByLegacyKey,
  storedSocialImageResponse,
} from "@/lib/performance/social-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const requestedVersion = new URL(request.url).searchParams.get("v") ?? "latest";
  if (requestedVersion !== "latest") {
    try {
      const legacyImage = await loadStoredSocialImageByLegacyKey(
        journalLegacyImageKey(requestedVersion)
      );
      if (legacyImage) return storedSocialImageResponse(legacyImage);
    } catch (error) {
      console.error("[performance/og] failed to load legacy journal image", error);
    }
  }

  const result = await getLivePerformanceDataset();
  if (result.status !== "available") {
    return new Response("Performance journal unavailable", { status: 503 });
  }

  const dataset = result.dataset;
  const view = buildPerformanceView(dataset, "YTD", sydneyYear(dataset.asOf));
  try {
    const reference = await ensureJournalSocialImage(dataset, view);
    const image = await loadStoredSocialImage(reference.publicKey);
    if (image) {
      const cacheControl = requestedVersion === "latest"
        ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
        : "public, max-age=31536000, immutable";
      return storedSocialImageResponse(image, cacheControl);
    }
  } catch (error) {
    console.error(
      `[performance/og] failed to persist journal image ${legacyJournalImageVersion(view)}`,
      error
    );
  }
  return new ImageResponse(<PerformanceOpenGraphCard dataset={dataset} view={view} />, {
    width: 1200,
    height: 630,
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
