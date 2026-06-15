import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { getSession } from "../../../../lib/session";

// Serves a private course resource (e.g. the TJSS PDF) from MongoDB.
// Requires a verified session.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user?.emailVerified) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { slug } = await params;
  const db = getDb();
  const resource = await db
    .collection("resources")
    .findOne({ slug });

  if (!resource) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Binary stored via the mongodb driver -> Buffer
  const buffer: Buffer = resource.data.buffer
    ? Buffer.from(resource.data.buffer)
    : Buffer.from(resource.data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": resource.contentType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${resource.filename ?? slug}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
