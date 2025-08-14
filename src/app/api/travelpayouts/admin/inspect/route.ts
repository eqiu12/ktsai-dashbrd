import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get("url");
    const token = searchParams.get("token");
    if (!rawUrl || !token) return NextResponse.json({ error: "url and token required" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require("@libsql/client");
    const url = `${rawUrl}?authToken=${token}`;
    const client = createClient({ url });

    const info = await client.execute(`PRAGMA table_info('travelpayouts_actions')`);
    const sample = await client.execute(
      `SELECT * FROM travelpayouts_actions WHERE account_id = ? ORDER BY updated_at DESC LIMIT 5`,
      [searchParams.get("account_id")]
    );

    return NextResponse.json({ ok: true, columns: info.rows, sample: sample.rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}




