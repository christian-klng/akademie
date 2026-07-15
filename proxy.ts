import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySession } from "./lib/auth";

// Next.js 16 renamed Middleware to Proxy. Only the admin area is gated behind
// the session cookie — the public site (home, events, legal pages) and /login
// stay open. Server actions POST to the page path they're defined on, so the
// admin mutations under /admin/* are covered by this gate too.
export default async function proxy(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
