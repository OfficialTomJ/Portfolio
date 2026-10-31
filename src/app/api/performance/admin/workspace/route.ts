import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { getWorkspace, mutateWorkspace, WorkspaceConflict, WorkspaceInput } from "@/lib/performance/workspace-store";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control":"private, no-store", "X-Robots-Tag":"noindex, nofollow" };
export async function GET() {
  if (!await getPerformanceAdminSession()) return NextResponse.json({ error:"Not found" }, { status:404, headers });
  try { return NextResponse.json(await getWorkspace(), { headers }); }
  catch { return NextResponse.json({ error:"Workspace unavailable. Existing records are unchanged." }, { status:503, headers }); }
}
export async function POST(request:NextRequest) {
  const session = await getPerformanceAdminSession();
  if (!session) return NextResponse.json({ error:"Not found" }, { status:404, headers });
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error:"Forbidden" }, { status:403, headers });
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new WorkspaceInput("Empty request");
    const chunks:Uint8Array[] = []; let size=0;
    while (true) { const next=await reader.read(); if(next.done) break; size+=next.value.length; if(size>650000) { await reader.cancel(); return NextResponse.json({error:"Edit is too large"},{status:413,headers}); } chunks.push(next.value); }
    let body:unknown; try { body=JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new WorkspaceInput("Invalid edit"); }
    return NextResponse.json(await mutateWorkspace(body, session.user.id), { headers });
  } catch(e) {
    const status=e instanceof WorkspaceConflict?409:e instanceof WorkspaceInput?400:500;
    if(status===500) console.error("[performance/workspace] command failed");
    return NextResponse.json({ error:status===500?"Could not complete the change. Refresh to check its saved status before retrying.":(e as Error).message },{status,headers});
  }
}
