import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth";

export async function POST() {
  const response = NextResponse.json({ data: { loggedOut: true } });
  response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  response.cookies.set("active_website_id", "", { path: "/", maxAge: 0 });
  return response;
}
