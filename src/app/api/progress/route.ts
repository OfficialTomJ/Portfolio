import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../lib/session";
import { getUserProgress, upsertProgress } from "../../../lib/progress";

const bodySchema = z.object({
  episodeSlug: z.string().min(1).max(120),
  percent: z.number().min(0).max(100).optional(),
  seconds: z.number().min(0).optional(),
  completed: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const progress = await getUserProgress(session.user.id);
  return NextResponse.json({ progress });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.emailVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { episodeSlug, percent, seconds, completed } = parsed.data;
  await upsertProgress(session.user.id, episodeSlug, { percent, seconds, completed });
  return NextResponse.json({ ok: true });
}
