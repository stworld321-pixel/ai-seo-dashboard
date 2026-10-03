import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { isAdminEmail } from "@/server/authz";

const PUBLIC_FILE_REGEX = /\.(.*)$/;

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/pricing",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/integrations/google/callback",
  "/api/db-health", // gated by CRON_SECRET, not by session
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets, images, and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/static") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE_REGEX.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith("/api/auth/"));
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(sessionToken);

  // 2. If user is logged in and visits /login or /register, redirect to dashboard
  if (session && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = session.isAdmin ? "/admin" : "/";
    return NextResponse.redirect(url);
  }

  // 3. Allow public auth endpoints
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 4. Require authentication for all dashboard routes
  if (!session) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required or session expired." } },
        { status: 401 },
      );
      response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
      return response;
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("returnTo", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return response;
  }

  // 5. Check Admin privilege for /admin routes and the admin APIs behind them.
  //    Decided by the configured address only: session.isAdmin / session.role
  //    are claims minted at login, so a token issued before a demotion would
  //    otherwise keep working until it expired.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!isAdminEmail(session.email)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Administrator access required." } },
          { status: 403 },
        );
      }
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/";
      dashboardUrl.searchParams.set("error", "admin_required");
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
