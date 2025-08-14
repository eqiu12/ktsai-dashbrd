import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { execute } from "@/lib/sql";
import { ensureSchema } from "@/lib/schemaInit";

export async function POST() {
  try {
    await ensureSchema();
    await execute(`DELETE FROM "TravelpayoutsAction"`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}




