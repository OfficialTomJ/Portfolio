import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../lib/session";
import { getDisclosure, recordDisclosure } from "../../../lib/disclosure";
import { checkRateLimit } from "../../../lib/ratelimit";
import { DISCLOSURE_VERSION } from "../../../lib/disclosure-config";

const bodySchema = z.object({
  version: z.number().int(),
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const acceptance = await getDisclosure(session.user.id);
  return NextResponse.json({ acceptance });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.emailVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await checkRateLimit(`disclosure:${session.user.id}`, 20, 60);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.version !== DISCLOSURE_VERSION) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await recordDisclosure(session.user.id, DISCLOSURE_VERSION);
  return NextResponse.json({ ok: true });
}
