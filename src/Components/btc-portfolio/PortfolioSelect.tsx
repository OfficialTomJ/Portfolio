import type { SelectHTMLAttributes } from "react";
import { FiChevronDown } from "react-icons/fi";

/** Native keyboard/picker behaviour with a consistent SVG affordance on iOS. */
export default function PortfolioSelect({ label, quiet = false, className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; quiet?: boolean }) {
  return <label className={`relative inline-flex min-w-0 ${className}`}>
    <span className="sr-only">{label}</span>
    <select {...props} aria-label={label} className={`min-h-11 w-full min-w-0 appearance-none rounded-lg bg-[#0a0a0c] pl-2 pr-6 text-base text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-[#ff8b52]/60 sm:text-xs ${quiet ? "border border-transparent" : "border border-white/10"}`}>
      {children}
    </select>
    <FiChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500"/>
  </label>;
}
