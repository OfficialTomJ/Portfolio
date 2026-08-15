import "server-only";
import { Bar } from "./types";
import { getDailyCandles } from "./price";
import { getFngHistory, fngByDay } from "./fng";

/**
 * Fetch BTC daily candles + real F&G history and align them by UTC day into a
 * single `Bar[]` (candles are the spine; F&G is null before 2018-02-01).
 */
export async function getAlignedBars(symbol = "BTCUSDT"): Promise<Bar[]> {
  const [candles, fng] = await Promise.all([
    getDailyCandles(symbol),
    getFngHistory(),
  ]);
  const byDay = fngByDay(fng);
  return candles.map((c) => ({ ...c, fng: byDay.get(c.time) ?? null }));
}
