import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { portfolioDatabaseEnabled } from "@/lib/btc-portfolio/mode";
import { loadPortfolioWorkspace, mutatePortfolioWorkspace } from "@/lib/btc-portfolio/workspace-repository";
import { WorkspaceConflict, workspaceCommandSchema } from "@/lib/btc-portfolio/workspace-model";
import { ZodError } from "zod";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "syd1";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });
export async function GET() {
  if (!portfolioDatabaseEnabled() || !await getPerformanceAdminSession()) return json({ error: "Not found" }, 404);
  try { return json(await loadPortfolioWorkspace()); } catch { return json({ error: "Portfolio workspace unavailable." }, 503); }
}
export async function POST(request: NextRequest) {
  if (!portfolioDatabaseEnabled()) return json({ error: "Not found" }, 404);
  const session = await getPerformanceAdminSession();
  if (!session) return json({ error: "Not found" }, 404);
  if (!isSameOriginAdminRequest(request)) return json({ error: "Forbidden" }, 403);
  const raw = await request.text();
  if (raw.length > 2000000) return json({ error: "This edit is too large." }, 413);
  let command;
  try { command = workspaceCommandSchema.parse(JSON.parse(raw)); }
  catch { return json({ error: "Invalid portfolio edit. Check the fields and try again." }, 400); }
  try { return json(await mutatePortfolioWorkspace(command, session.user.id)); }
  catch (error) {
    if (error instanceof WorkspaceConflict) return json({ error: error.message }, 409);
    if (error instanceof ZodError) return json({ error: error.issues[0]?.message ?? "Invalid draft." }, 400);
    return json({ error: "Could not apply this edit. Check chronology, balances and validation; refresh status before retrying. Your form is retained." }, 400);
  }
}
