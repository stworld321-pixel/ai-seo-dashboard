import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/server/auth";
import { isAdminEmail } from "@/server/authz";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid email or password",
        },
      },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const rawEmail = parsed.data.email.trim();
  const password = parsed.data.password;
  const rememberMe = parsed.data.rememberMe ?? true;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: rawEmail },
          { email: email },
        ],
      },
    });
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email address or password. Please check your credentials or create an account.",
        },
      },
      { status: 401 },
    );
  }

  // Single source of truth (src/server/authz.ts). This used to also accept the
  // database isAdmin flag and a role of "ADMIN", which minted a session claiming
  // admin for accounts the gate then refused — confusing, and the wrong default.
  const isSystemAdmin = isAdminEmail(user.email);

  let membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
  });

  let userOrgId = membership?.orgId;
  if (!userOrgId) {
    const newOrg = await prisma.organization.create({
      data: {
        name: `${user.name || "My"} Workspace`,
        slug: `org-${user.id.slice(-6)}-${Math.random().toString(36).slice(2, 6)}`,
      },
    });
    await prisma.orgMember.create({
      data: { orgId: newOrg.id, userId: user.id, role: "OWNER" },
    });
    userOrgId = newOrg.id;
  }

  // Find user's own most recently accessed or created website
  const userWebsites = await prisma.website.findMany({
    where: { orgId: userOrgId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const primaryWebsiteId = userWebsites[0]?.id ?? null;

  const ttlDays = rememberMe ? 30 : 1;
  const token = await createSessionToken(
    {
      userId: user.id,
      email: user.email,
      name: user.name ?? email.split("@")[0]!,
      isAdmin: isSystemAdmin,
      role: isSystemAdmin ? "ADMIN" : "USER",
      orgId: userOrgId,
    },
    ttlDays,
  );

  const response = NextResponse.json({
    data: {
      user: {
        id: user.id,
        name: user.name ?? email.split("@")[0]!,
        email: user.email,
        isAdmin: isSystemAdmin,
        role: isSystemAdmin ? "ADMIN" : "USER",
      },
      redirectTo: isSystemAdmin ? "/admin" : (primaryWebsiteId ? "/" : "/onboarding"),
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * ttlDays,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  if (primaryWebsiteId) {
    response.cookies.set("active_website_id", primaryWebsiteId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    response.cookies.set("active_website_id", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
  }

  return response;
}
