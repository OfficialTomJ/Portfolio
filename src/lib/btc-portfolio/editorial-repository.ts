import "server-only";
import { getMongoClient } from "@/lib/mongodb";
import { portfolioEditorialNoteSchema } from "./stories";
import { publicSchema, type PublicPortfolio } from "./schema";

/** Approved editorial summaries only; never load execution or private research collections into the visitor response. */
export async function withLocalEditorialNotes(data: PublicPortfolio): Promise<PublicPortfolio> {
  if (process.env.NODE_ENV !== "development") return data;
  const records = await getMongoClient().db("blueprint_dev").collection<{ _id: string; status: string; note: unknown }>("portfolio_editorial_notes")
    .find({ status: "approved-localhost" }, { projection: { _id: 0, note: 1 } }).limit(200).toArray();
  return publicSchema.parse({ ...data, editorialNotes: records.map(record => portfolioEditorialNoteSchema.parse(record.note)).sort((a, b) => b.period.localeCompare(a.period)) });
}
