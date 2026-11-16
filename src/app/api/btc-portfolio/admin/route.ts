import { NextRequest, NextResponse } from "next/server";
import { getPerformanceAdminSession, isSameOriginAdminRequest } from "@/lib/performance/admin-access";
import { commandSchema } from "@/lib/btc-portfolio/schema";
import { btcMockEnabled, portfolioDatabaseEnabled } from "@/lib/btc-portfolio/mode";
import { loadBtcAdmin, mutateBtc } from "@/lib/btc-portfolio/repository";
import { PortfolioConflictError } from "@/lib/btc-portfolio/model";
import { PortfolioInputError } from "@/lib/btc-portfolio/engine";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
export async function GET() {
  if (portfolioDatabaseEnabled() || !btcMockEnabled() || !await getPerformanceAdminSession()) return json({ error: "Not found" }, 404);
  try { return json(await loadBtcAdmin()); } catch { return json({ error: "Mock portfolio storage is unavailable. No data has changed." }, 503); }
}
export async function POST(request: NextRequest) {
  if (portfolioDatabaseEnabled() || !btcMockEnabled()) return json({ error: "Not found" }, 404);
  const session = await getPerformanceAdminSession();
  if (!session) return json({ error: "Not found" }, 404);
  if (!isSameOriginAdminRequest(request)) return json({ error: "Forbidden" }, 403);
  const raw = await request.text();
  if (raw.length > 250000) return json({ error: "Import is too large." }, 413);
  let input: unknown; try { input = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid edit." }, 400);
  try { return json(await mutateBtc(parsed.data, session.user.id)); }
  catch (e) {
    if (e instanceof PortfolioConflictError) return json({ error: e.message }, 409);
    if (e instanceof PortfolioInputError) return json({ error: e.message }, 400);
    if (e instanceof ZodError) return json({ error: e.issues[0]?.message ?? "Invalid ledger." }, 400);
    return json({ error: "Could not save. Your form is retained. Refresh status before retrying." }, 503);
  }
}
