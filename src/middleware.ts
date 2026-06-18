import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/cookie";

/**
 * Route prefixes that require a signed-in user. Middleware runs on the Edge
 * runtime, so it cannot touch Postgres/argon2 — it only checks for the presence
 * of the session cookie. Full session validation and role checks happen in Node
 * (server components / actions) via getCurrentProfile and the admin layout.
 */
const PROTECTED_PREFIXES = ["/account", "/admin", "/builds/new", "/builds/mine"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiresAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (requiresAuth && !request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role-based protection for /admin is enforced in src/app/admin/layout.tsx,
  // which reads the profile role server-side. Expose the path on the REQUEST
  // headers so the root layout's headers() can allow-list routes (e.g. /login)
  // during maintenance mode.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
