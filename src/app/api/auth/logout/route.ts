import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth";

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set("active_website_id", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    sameSite: "lax",
  });
  return response;
}

export async function POST() {
  const response = NextResponse.json({ data: { loggedOut: true } });
  return clearAuthCookies(response);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = new URL("/login", url.origin);
  const response = NextResponse.redirect(redirectUrl);
  return clearAuthCookies(response);
}
