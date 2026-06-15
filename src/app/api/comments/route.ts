import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../lib/session";
import { createComment, listComments } from "../../../lib/engagement";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.emailVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("episodeSlug");
  if (!slug) {
    return NextResponse.json({ error: "Missing episodeSlug" }, { status: 400 });
  }
  const comments = await listComments(slug, session.user.id);
  return NextResponse.json({ comments });
}

const postSchema = z.object({
  episodeSlug: z.string().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  parentId: z.string().length(24).nullish(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.emailVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { episodeSlug, body, parentId } = parsed.data;
  const id = await createComment(
    episodeSlug,
    { id: session.user.id, name: session.user.name, image: session.user.image },
    body,
    parentId ?? null
  );
  return NextResponse.json({ id });
}
