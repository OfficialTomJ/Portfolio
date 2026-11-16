import type { PortfolioFreshness } from "@/lib/btc-portfolio/refresh";
import { PORTFOLIO_TIME_ZONE } from "@/lib/btc-portfolio/view";

export const portfolioUpdateTime = (at: string) => new Intl.DateTimeFormat("en-AU", { timeZone: PORTFOLIO_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "short" }).format(new Date(at));

export default function PortfolioRefreshIndicator({ freshness }: { freshness: PortfolioFreshness }) {
  const delayed = freshness.status === "error" || freshness.status === "offline";
  return <div aria-label="Portfolio refresh status" className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 px-4 pt-3 text-[10px] leading-5 text-zinc-500 sm:px-7" title="Portfolio data updates automatically. Last refreshed is the latest successful check; the valuation time below the chart shows how current the portfolio values are.">
    <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${delayed ? "bg-amber-300" : freshness.status === "ready" ? "bg-[#7ad9b6]" : "bg-zinc-500"}`}/>
    {freshness.status !== "ready" && <span role="status">{freshness.status === "offline" ? "Offline · Showing saved data" : freshness.status === "error" ? "Refresh delayed · Showing saved data" : "Checking for updates…"}</span>}
    {freshness.checkedAt && <span>{delayed ? "· " : ""}Last refreshed <time dateTime={freshness.checkedAt}>{portfolioUpdateTime(freshness.checkedAt)}</time></span>}
  </div>;
}
