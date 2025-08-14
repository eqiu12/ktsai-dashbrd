import { NextResponse, NextRequest } from "next/server";

const COOKIE_NAME = "tp_auth";

// Public paths that do not require auth
const PUBLIC_PATHS: Array<RegExp> = [
  /^\/login$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/logout$/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/public\//,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((re) => re.test(pathname));
  if (isPublic) return NextResponse.next();

  const auth = req.cookies.get(COOKIE_NAME)?.value;
  if (auth === "1") return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/:path*"],
};


