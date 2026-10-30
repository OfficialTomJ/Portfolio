import { notFound, redirect } from "next/navigation";
import { getPerformanceAdminSession } from "@/lib/performance/admin-access";
export const dynamic="force-dynamic";
export const metadata={title:"Trade reconciliation | Admin",robots:{index:false,follow:false}};
export default async function HistoricalTradeEditor({params}:{params:Promise<{id:string}>}) {
  if(!await getPerformanceAdminSession())notFound();
  const {id}=await params;
  if(!/^trade-[a-f0-9]{20}$/.test(id))notFound();
  redirect(`/performance/review?trade=${encodeURIComponent(id)}`);
}
