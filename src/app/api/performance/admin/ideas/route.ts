import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { getIdeaHistory, getIdeasContext, getIdeasSnapshot } from "@/lib/performance/ideas-data";
import { ideaMutationSchema } from "@/lib/performance/ideas-model";
import { IdeaConflictError, IdeaInputError } from "@/lib/performance/ideas-repository";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function GET() {
  if (!await getPerformanceAdminSession()) return json({ error: "Not found" }, 404);
  try {
    const snapshot = await getIdeasSnapshot();
    return snapshot ? json(snapshot) : json({ error: "No synced account is available." }, 503);
  } catch {
    console.error("[performance/ideas] load failed");
    return json({ error: "Could not load ideas. Please try again." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await getPerformanceAdminSession();
  if (!session) return json({ error: "Not found" }, 404);
  if (!isSameOriginAdminRequest(request)) return json({ error: "Forbidden" }, 403);
  const raw = await request.text();
  if (raw.length > 40000) return json({ error: "Edit is too large" }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid edit" }, 400); }
  const parsed = ideaMutationSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid edit" }, 400);
  // Deletion must also unlink publication/reconciliation in the workspace transaction.
  if(parsed.data.action === "delete")return json({error:"Delete ideas from the journal workspace."},400);
  try {
    const context = await getIdeasContext();
    if (!context) return json({ error: "No synced account is available." }, 503);
    const history = await getIdeaHistory(context);
    const eligible = new Set(history.filter(t => !t.duplicateOf).map(t => t.id));
    return json(await context.repository.mutate(parsed.data, eligible, session.user.id));
  } catch (error) {
    if (error instanceof IdeaConflictError) return json({ error: error.message }, 409);
    if (error instanceof IdeaInputError) return json({ error: error.message }, 400);
    console.error("[performance/ideas] save failed");
    return json({ error: "Could not save ideas. Please try again." }, 500);
  }
}
