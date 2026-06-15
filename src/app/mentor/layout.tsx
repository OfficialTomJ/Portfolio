import "./mentor.css";
import Link from "next/link";
import { Jost } from "next/font/google";
import AuthNav from "../../Components/AuthNav";

const jost = Jost({ subsets: ["latin"] });

export const metadata = {
  title: "The Blueprint — Free Crypto Trading Course",
  description:
    "Learn to trade like a professional with Thomas Johnston's free Blueprint course.",
};

export default function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`blueprint ${jost.className}`}>
      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/60 border-b border-[var(--bp-border)]">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight">
              The Blueprint
            </span>
            <span className="text-[var(--bp-accent)] text-lg leading-none">.</span>
          </Link>
          <AuthNav />
        </nav>
      </header>
      {children}
    </div>
  );
}
