import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/session";
import { toggleCommentLike } from "../../../../../lib/engagement";
import { checkRateLimit } from "../../../../../lib/ratelimit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.emailVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await checkRateLimit(`clike:${session.user.id}`, 60, 60);
  if (limited) return limited;

  const { id } = await params;
  const result = await toggleCommentLike(id, session.user.id);
  return NextResponse.json(result);
}
