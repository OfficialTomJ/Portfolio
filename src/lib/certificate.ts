import "server-only";
import { randomUUID } from "crypto";
import { getDb } from "./mongodb";
import { getEpisodes } from "./blueprint";
import { getUserProgress } from "./progress";

const SEASON = 1;

export interface CertificateDoc {
  userId: string;
  certificateId: string;
  season: number;
  name: string;
  issuedAt: Date;
}

export interface CompletionStatus {
  total: number;
  completed: number;
  percent: number;
  isComplete: boolean;
}

export interface PublicCertificate {
  name: string;
  season: number;
  issuedAt: Date;
}

let indexed = false;
async function ensureIndex() {
  if (indexed) return;
  await getDb()
    .collection<CertificateDoc>("certificates")
    .createIndex({ userId: 1, season: 1 }, { unique: true });
  indexed = true;
}

/** Season-1 completion measured over video episodes only (resources excluded). */
export async function getCompletionStatus(
  userId: string
): Promise<CompletionStatus> {
  const [episodes, progress] = await Promise.all([
    getEpisodes(),
    getUserProgress(userId),
  ]);
  const videos = episodes.filter((e) => e.type === "video");
  const total = videos.length;
  const completed = videos.filter((v) => progress[v.slug]?.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percent, isComplete: total > 0 && completed === total };
}

/**
 * Returns the user's certificate, lazily issuing one on first completion.
 * Callers must confirm completion (getCompletionStatus) before calling.
 */
export async function getOrIssueCertificate(
  userId: string,
  name: string
): Promise<CertificateDoc> {
  await ensureIndex();
  const col = getDb().collection<CertificateDoc>("certificates");
  const existing = await col.findOne(
    { userId, season: SEASON },
    { projection: { _id: 0 } }
  );
  if (existing) return existing;

  const doc: CertificateDoc = {
    userId,
    certificateId: randomUUID(),
    season: SEASON,
    name,
    issuedAt: new Date(),
  };
  try {
    await col.insertOne(doc);
    return doc;
  } catch {
    // Lost a race against a concurrent issue — return the winner.
    const won = await col.findOne(
      { userId, season: SEASON },
      { projection: { _id: 0 } }
    );
    if (won) return won;
    throw new Error("Failed to issue certificate");
  }
}

/** Public lookup for the shareable verify page (no userId leakage). */
export async function getCertificateById(
  certificateId: string
): Promise<PublicCertificate | null> {
  const doc = await getDb()
    .collection<CertificateDoc>("certificates")
    .findOne(
      { certificateId },
      { projection: { _id: 0, name: 1, season: 1, issuedAt: 1 } }
    );
  if (!doc) return null;
  return { name: doc.name, season: doc.season, issuedAt: doc.issuedAt };
}
