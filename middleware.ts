import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { jsonError } from "@/lib/api/envelope";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  if (request.auth?.user) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api")) {
    return jsonError("UNAUTHORIZED", "Authentication required", 401);
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
});

export const config = {
  // `.*\\..*` (escaped dot) skips files with extensions such as /favicon.ico,
  // while application routes like /dashboard still require a session.
  matcher: [
    "/((?!api/auth|api/webhooks|api/ai/health|_next/static|_next/image|favicon.ico|login|.*\\..*).*)",
  ],
};
