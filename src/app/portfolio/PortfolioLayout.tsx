import { Metadata } from "next";

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section>{children}</section>;
}
