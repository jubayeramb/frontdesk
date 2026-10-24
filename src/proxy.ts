import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/staff/session";

// Optimistic check: send visitors without a staff session to sign-in.
// Pages and actions verify the session again with requireStaff().
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/staff/sign-in") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const keys = { secret: env.STAFF_SESSION_SECRET, password: env.STAFF_PASSWORD };
  if (verifySessionToken(token, keys, new Date())) return NextResponse.next();

  const signIn = new URL("/staff/sign-in", request.url);
  signIn.searchParams.set("next", pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/staff", "/staff/:path*"],
};
