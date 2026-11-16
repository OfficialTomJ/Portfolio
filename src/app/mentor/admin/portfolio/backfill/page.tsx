import { notFound, redirect } from "next/navigation";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
import { portfolioDatabaseEnabled } from "@/lib/btc-portfolio/mode";
export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolio Admin", robots: { index: false, follow: false } };
export default async function Backfill() { if (!portfolioDatabaseEnabled() || !await getPerformanceAdminSession()) notFound(); redirect("/admin/portfolio"); }
