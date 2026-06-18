import "./mentor.css";
import Link from "next/link";
import { Jost } from "next/font/google";
import AuthNav from "../../Components/AuthNav";
import TopProgress from "../../Components/TopProgress";
import DisclosureModal from "../../Components/DisclosureModal";
import MentorAnalytics from "../../Components/MentorAnalytics";

const jost = Jost({ subsets: ["latin"] });

export const metadata = {
  title: "The Blueprint — Free Crypto Trading Course",
  description:
    "Learn to trade like a professional with Thomas Johnston's free Blueprint course.",
};

// Dark browser chrome (fixes the white iOS Safari bottom-bar gradient).
export const viewport = {
  themeColor: "#000000",
  colorScheme: "dark" as const,
};

export default function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`blueprint ${jost.className}`}>
      <MentorAnalytics />
      <TopProgress />
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
      <footer className="mt-16 border-t border-[var(--bp-border)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-sm text-[var(--bp-text-dim)] sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} Thomas Johnston. All rights reserved.</span>
          <Link
            href="/compliance"
            className="transition-colors hover:text-[var(--bp-text)]"
          >
            Compliance &amp; Disclosure
          </Link>
        </div>
      </footer>
      <DisclosureModal />
    </div>
  );
}
