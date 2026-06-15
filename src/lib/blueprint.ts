import "server-only";
import { getDb } from "./mongodb";

export type EpisodeType = "video" | "resource";

export interface Episode {
  slug: string;
  type: EpisodeType;
  seasonNumber: number;
  episodeNumber: number;
  section: string;
  sectionOrder: number;
  title: string;
  youtubeId?: string;
  outlineMarkdown?: string;
  resourceSlug?: string; // for type "resource" -> resources collection
  order: number; // global ordering within the season
  published: boolean;
}

export interface Section {
  name: string;
  order: number;
  episodes: Episode[];
}

const EPISODE_PROJECTION = { projection: { _id: 0 } } as const;

/** All published episodes, ordered. Server-only (queries Mongo). */
export async function getEpisodes(): Promise<Episode[]> {
  const db = getDb();
  return db
    .collection<Episode>("episodes")
    .find({ published: true }, EPISODE_PROJECTION)
    .sort({ order: 1 })
    .toArray();
}

/** A single published episode by slug, or null. */
export async function getEpisode(slug: string): Promise<Episode | null> {
  const db = getDb();
  return db
    .collection<Episode>("episodes")
    .findOne({ slug, published: true }, EPISODE_PROJECTION);
}

/** Episodes grouped into ordered sections (the "Season 1" rows). */
export async function getSections(): Promise<Section[]> {
  const episodes = await getEpisodes();
  const map = new Map<string, Section>();
  for (const ep of episodes) {
    let section = map.get(ep.section);
    if (!section) {
      section = { name: ep.section, order: ep.sectionOrder, episodes: [] };
      map.set(ep.section, section);
    }
    section.episodes.push(ep);
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

/** The episode immediately after the given one (for "Next episode"). */
export async function getNextEpisode(slug: string): Promise<Episode | null> {
  const episodes = await getEpisodes();
  const idx = episodes.findIndex((e) => e.slug === slug);
  if (idx === -1 || idx === episodes.length - 1) return null;
  return episodes[idx + 1];
}
