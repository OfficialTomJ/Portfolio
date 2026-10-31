import { notFound, redirect } from "next/navigation";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
export const dynamic = "force-dynamic";
export const metadata = {robots:{index:false,follow:false}};
export default async function LegacyReview({searchParams}:{searchParams:Promise<{view?:string;trade?:string}>}) {
  if (!await getPerformanceAdminSession()) notFound();
  const query=await searchParams, params=new URLSearchParams();
  if (query.view) params.set("view",query.view);
  if (query.trade) params.set("trade",query.trade);
  redirect(`/admin${params.size ? `?${params}` : ""}`);
}
