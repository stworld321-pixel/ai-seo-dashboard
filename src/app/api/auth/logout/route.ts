import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth";

export async function POST() {
  const response = NextResponse.json({ data: { loggedOut: true } });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
