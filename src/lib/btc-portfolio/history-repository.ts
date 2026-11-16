import "server-only";
import { getMongoClient } from "@/lib/mongodb";
import type { PublicPortfolio } from "./schema";
import { combinePortfolioHistory, localChartHistorySchema } from "./history";

/** Localhost approval cannot enable history on a deployed site. Never reads private source records. */
export async function withLocalChartHistory(current: PublicPortfolio) {
  if (process.env.NODE_ENV !== "development") return current;
  const record = await getMongoClient().db("blueprint_dev")
    .collection<{ _id: string; status: string; chart: unknown }>("portfolio_local_chart_history")
    .findOne({ _id: "combined", status: "approved-localhost" }, { projection: { _id: 0, chart: 1 } });
  return record ? combinePortfolioHistory(current, localChartHistorySchema.parse(record.chart)) : current;
}
