import { publicSchema, type PublicPortfolio } from "./schema";

export const PORTFOLIO_REFRESH_MS = 15_000;
export const PORTFOLIO_REFRESH_TIMEOUT_MS = 10_000;
export type PortfolioRefreshStatus = "checking" | "ready" | "error" | "offline";
export interface PortfolioFreshness { status: PortfolioRefreshStatus; checkedAt: string | null }
export interface PortfolioRefreshResult { data: PublicPortfolio; checkedAt: string }

export async function fetchPortfolioSnapshot(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<PortfolioRefreshResult> {
  const response = await fetcher("/api/btc-portfolio", { cache: "no-store", credentials: "omit", redirect: "error", signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Portfolio refresh unavailable.");
  // Refreshes use the same percentage-only allowlist as the initial server render.
  const data = publicSchema.parse(await response.json());
  const checked = response.headers.get("X-Portfolio-Checked-At");
  return { data, checkedAt: checked && Number.isFinite(Date.parse(checked)) ? new Date(checked).toISOString() : new Date().toISOString() };
}

/** One shared snapshot updates every chart; failures never replace the last good data. */
export function watchPortfolio(options: {
  onData: (result: PortfolioRefreshResult) => void;
  onError: () => void;
  isActive?: () => boolean;
  fetchSnapshot?: (signal: AbortSignal) => Promise<PortfolioRefreshResult>;
}) {
  let stopped = false;
  let active: { controller: AbortController; cancel: () => void } | undefined;
  const refresh = async () => {
    if (stopped || active || options.isActive?.() === false) return;
    const controller = new AbortController();
    let timedOut = false, rejectRequest!: (reason: Error) => void;
    const deadline = new Promise<never>((_, reject) => { rejectRequest = reject; });
    const timeout = setTimeout(() => {
      timedOut = true; controller.abort(); rejectRequest(new Error("Portfolio refresh timed out."));
    }, PORTFOLIO_REFRESH_TIMEOUT_MS);
    const request = { controller, cancel: () => { controller.abort(); clearTimeout(timeout); rejectRequest(new Error("Portfolio refresh cancelled.")); } };
    active = request;
    try {
      const result = await Promise.race([(options.fetchSnapshot ?? fetchPortfolioSnapshot)(controller.signal), deadline]);
      if (!stopped && !controller.signal.aborted) options.onData(result);
    } catch {
      if (!stopped && (!controller.signal.aborted || timedOut)) options.onError();
    } finally {
      clearTimeout(timeout);
      if (active === request) active = undefined;
    }
  };
  const cancel = () => { const request = active; active = undefined; request?.cancel(); };
  const interval = setInterval(() => { void refresh(); }, PORTFOLIO_REFRESH_MS);
  void refresh();
  return { refresh, cancel, stop: () => { stopped = true; clearInterval(interval); cancel(); } };
}
