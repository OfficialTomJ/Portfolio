import "server-only";

import { getLivePerformanceDataset } from "./data";
import { ensureJournalSocialImage, ensureTradeSocialImage } from "./social-images";

export interface PerformanceSocialImagePublishResult {
  tradeImagesCreated: number;
  journalImagesCreated: number;
  imagesReused: number;
  failures: string[];
}

export async function publishCurrentPerformanceSocialImages(): Promise<PerformanceSocialImagePublishResult> {
  const result: PerformanceSocialImagePublishResult = {
    tradeImagesCreated: 0,
    journalImagesCreated: 0,
    imagesReused: 0,
    failures: [],
  };
  const datasetResult = await getLivePerformanceDataset();
  if (datasetResult.status !== "available") {
    result.failures.push("performance dataset unavailable");
    return result;
  }

  for (const trade of datasetResult.dataset.trades) {
    try {
      const image = await ensureTradeSocialImage(trade);
      if (image.created) result.tradeImagesCreated += 1;
      else result.imagesReused += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown image error";
      result.failures.push(`${trade.id}: ${message}`);
    }
  }

  try {
    const image = await ensureJournalSocialImage(datasetResult.dataset);
    if (image.created) result.journalImagesCreated += 1;
    else result.imagesReused += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown image error";
    result.failures.push(`journal: ${message}`);
  }

  return result;
}
