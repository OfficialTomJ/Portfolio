import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function retired() { return NextResponse.json({ error: "Account sync is retired. Use the admin CSV importer." }, { status: 410, headers: { "Cache-Control": "no-store" } }); }
export const GET = retired;
export const POST = retired;
