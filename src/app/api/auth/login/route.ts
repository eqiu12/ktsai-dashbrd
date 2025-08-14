import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isValidCodephrase } from "@/lib/auth";

const COOKIE_NAME = "tp_auth";

export async function POST(req: NextRequest) {
  const data = (await req.json().catch(() => ({}))) as { codephrase?: string };
  const codephrase = data.codephrase ?? "";
  const ok = await isValidCodephrase(codephrase);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Invalid codephrase" }, { status: 401 });
  }
  const store = await cookies();
  store.set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return NextResponse.json({ ok: true });
}


