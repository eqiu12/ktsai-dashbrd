import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "tp_auth";

export async function POST() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 0 });
  return NextResponse.json({ ok: true });
}


