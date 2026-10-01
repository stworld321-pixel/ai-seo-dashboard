import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE_NAME,
} from "@/server/auth";

const registerSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters").max(120),
  email: z.string().email("Please enter a valid email address").max(180),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  workspaceName: z.string().max(120).optional(),
  plan: z.enum(["BASIC", "STARTER", "PRO", "ENTERPRISE"]).optional().default("BASIC"),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid registration details",
        },
      },
      { status: 400 },
    );
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const workspaceName = parsed.data.workspaceName?.trim() || `${name}'s Workspace`;
  const selectedPlan = parsed.data.plan.toUpperCase() === "STARTER" ? "BASIC" : parsed.data.plan.toUpperCase();

  const initialCredits = selectedPlan === "ENTERPRISE" ? 100000 : selectedPlan === "PRO" ? 25000 : 5000;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      {
        error: {
          code: "EMAIL_EXISTS",
          message: "An account with this email address already exists. Please sign in instead.",
        },
      },
      { status: 409 },
    );
  }

  const configuredAdminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "suriyamanikandan4@gmail.com")
    .toLowerCase()
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const isConfiguredAdmin =
    configuredAdminEmails.includes(email) ||
    email === "suriyamanikandan4@gmail.com";

  const passwordHash = hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      isAdmin: isConfiguredAdmin,
      role: isConfiguredAdmin ? "ADMIN" : "USER",
      plan: isConfiguredAdmin ? "ENTERPRISE" : selectedPlan,
      creditsRemaining: isConfiguredAdmin ? 100000 : initialCredits,
      creditsTotal: isConfiguredAdmin ? 100000 : initialCredits,
    },
  });

  const cleanSlugBase = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "workspace";
  const orgSlug = `${cleanSlugBase}-${user.id.slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;

  const org = await prisma.organization.create({
    data: {
      name: workspaceName,
      slug: orgSlug,
    },
  });

  await prisma.orgMember.create({
    data: {
      orgId: org.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  const token = createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name ?? name,
    isAdmin: isConfiguredAdmin,
    role: isConfiguredAdmin ? "ADMIN" : "USER",
    orgId: org.id,
    orgName: org.name,
  });

  const response = NextResponse.json({
    data: {
      user: {
        id: user.id,
        name: user.name ?? name,
        email: user.email,
        isAdmin: isConfiguredAdmin,
        role: isConfiguredAdmin ? "ADMIN" : "USER",
      },
      redirectTo: "/onboarding",
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  // Clear any legacy/stale website cookie from previous sessions
  response.cookies.set("active_website_id", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });

  return response;
}
