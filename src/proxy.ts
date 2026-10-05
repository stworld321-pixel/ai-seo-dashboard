import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/server/auth";

const PUBLIC_FILE_REGEX = /\.(.*)$/;

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/integrations/google/callback",
  "/api/integrations/google/debug",
  "/api/db-health", // gated by CRON_SECRET, not by session
];

export function proxy(request: NextRequest) {
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
  const session = verifySessionToken(sessionToken);

  // 2. If user is logged in and visits /login or /register, redirect to dashboard
  if (session && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 3. Allow public auth endpoints
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 4. Require authentication for all dashboard routes
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required to access this resource." } },
        { status: 401 },
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Check Admin privilege for /admin routes
  if (pathname.startsWith("/admin")) {
    const configuredAdminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "suriyamanikandan4@gmail.com")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const userEmail = (session.email || "").toLowerCase();
    const isUserAdmin =
      Boolean(session.isAdmin) ||
      session.role === "ADMIN" ||
      configuredAdminEmails.includes(userEmail) ||
      userEmail === "suriyamanikandan4@gmail.com";

    if (!isUserAdmin) {
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
