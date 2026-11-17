"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track } from "../lib/track";

export type PortfolioPlacement =
  | "header"
  | "mobile_menu"
  | "home_hero"
  | "home_card"
  | "course_final"
  | "final_episode"
  | "course_completion"
  | "dashboard_related";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  placement: PortfolioPlacement;
};

export default function PortfolioLink({ placement, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      href="/portfolio"
      onClick={(event) => {
        track("portfolio_link_click", { placement });
        onClick?.(event);
      }}
    />
  );
}
