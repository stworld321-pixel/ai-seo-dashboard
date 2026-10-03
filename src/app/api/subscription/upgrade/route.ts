import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { normalizePlan, PLAN_LIMITS } from "@/server/services/credits";

const upgradeSchema = z.object({
  planId: z.enum(["free", "lite", "pro", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]).default("yearly"),
});

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to upgrade your subscription." } },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = upgradeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Invalid plan selected" } },
      { status: 400 },
    );
  }

  const planKey = parsed.data.planId.toUpperCase();
  const normalizedKey = normalizePlan(planKey);
  const planConfig = PLAN_LIMITS[normalizedKey];

  if (!planConfig) {
    return NextResponse.json(
      { error: { code: "PLAN_NOT_FOUND", message: "Selected plan not found" } },
      { status: 404 },
    );
  }

  // Update user in DB
  const updatedUser = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      plan: normalizedKey,
      creditsTotal: planConfig.credits,
      creditsRemaining: planConfig.credits,
    } as any,
  });

  return NextResponse.json({
    data: {
      success: true,
      user: {
        id: updatedUser.id,
        plan: updatedUser.plan,
        creditsTotal: (updatedUser as any).creditsTotal,
        creditsRemaining: (updatedUser as any).creditsRemaining,
      },
      planName: planConfig.name,
      message: `Your account has been successfully upgraded to ${planConfig.name}! All features and ${planConfig.credits.toLocaleString()} credits are active.`,
    },
  });
}
