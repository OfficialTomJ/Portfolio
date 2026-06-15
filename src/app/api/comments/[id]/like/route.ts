import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/session";
import { toggleCommentLike } from "../../../../../lib/engagement";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.emailVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const result = await toggleCommentLike(id, session.user.id);
  return NextResponse.json(result);
}
