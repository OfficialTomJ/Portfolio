import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/session";
import { toggleEpisodeLike } from "../../../../../lib/engagement";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user?.emailVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const result = await toggleEpisodeLike(slug, session.user.id);
  return NextResponse.json(result);
}
