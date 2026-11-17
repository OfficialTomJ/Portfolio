import { FaArrowRight, FaChartLine } from "react-icons/fa";
import PortfolioLink, { type PortfolioPlacement } from "./PortfolioLink";

export default function PortfolioCard({
  variant,
  placement,
}: {
  variant: "landing" | "row" | "compact";
  placement: PortfolioPlacement;
}) {
  if (variant === "row") {
    return (
      <PortfolioLink placement={placement} className="bp-card group block w-[260px] rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--bp-accent)] sm:w-[300px]">
        <div className="bp-surface flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6719]/15 via-black to-black transition-colors group-hover:border-[var(--bp-border-strong)]">
          <FaChartLine aria-hidden="true" className="text-3xl text-[var(--bp-accent)]" />
        </div>
        <p className="mt-2 text-xs text-[var(--bp-text-dim)]">Public Portfolio</p>
        <p className="mt-1 text-sm font-medium">Follow the portfolio and the thinking behind it.</p>
        <p className="mt-1 text-xs leading-5 text-[var(--bp-text-dim)]">Performance, current allocation and the ideas behind decisions.</p>
        <span className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs text-[var(--bp-accent)]">View portfolio <FaArrowRight aria-hidden="true" /></span>
      </PortfolioLink>
    );
  }

  const landing = variant === "landing";
  return (
    <PortfolioLink
      placement={placement}
      className={`bp-surface group flex flex-col gap-5 rounded-xl outline-offset-4 transition-colors hover:border-[var(--bp-border-strong)] focus-visible:outline-2 focus-visible:outline-[var(--bp-accent)] sm:flex-row sm:items-center sm:gap-6 ${landing ? "p-6 sm:p-8" : "p-5 sm:p-6"}`}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--bp-accent)]/15 text-[var(--bp-accent)]">
        <FaChartLine aria-hidden="true" className="text-xl" />
      </span>
      <div className="min-w-0 flex-1">
        {landing && <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--bp-accent)]">Public Portfolio</p>}
        <h2 className={landing ? "mt-2 text-xl font-semibold sm:text-2xl" : "text-lg font-semibold"}>
          {landing ? "Follow the portfolio and the thinking behind it." : "Explore my public portfolio"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--bp-text-dim)]">
          {landing
            ? "Explore performance in USD and against Bitcoin, current allocation, and the ideas behind portfolio decisions."
            : "View portfolio performance, current allocation and the ideas behind decisions."}
        </p>
      </div>
      <span className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-[var(--bp-accent)]">
        {landing ? "View public portfolio" : "View portfolio"}
        <FaArrowRight aria-hidden="true" className="text-xs transition-transform group-hover:translate-x-1" />
      </span>
    </PortfolioLink>
  );
}
