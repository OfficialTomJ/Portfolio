import "server-only";
import { getDb } from "./mongodb";

export interface DisclosureDoc {
  userId: string;
  version: number;
  acceptedAt: Date;
  updatedAt: Date;
}

/** What the client needs to decide validity (via isAcceptanceValid). */
export interface DisclosureAcceptance {
  version: number;
  acceptedAt: Date;
}

let indexed = false;
async function ensureIndex() {
  if (indexed) return;
  await getDb()
    .collection("disclosures")
    .createIndex({ userId: 1 }, { unique: true });
  indexed = true;
}

/** The user's most recent disclosure acceptance, or null if none recorded. */
export async function getDisclosure(
  userId: string
): Promise<DisclosureAcceptance | null> {
  const doc = await getDb()
    .collection<DisclosureDoc>("disclosures")
    .findOne({ userId });
  if (!doc) return null;
  return { version: doc.version, acceptedAt: doc.acceptedAt };
}

/** Record (or refresh) the user's acceptance of the given disclosure version. */
export async function recordDisclosure(
  userId: string,
  version: number
): Promise<void> {
  await ensureIndex();
  const now = new Date();
  await getDb()
    .collection<DisclosureDoc>("disclosures")
    .updateOne(
      { userId },
      { $set: { userId, version, acceptedAt: now, updatedAt: now } },
      { upsert: true }
    );
}
