import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";

const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  name: z.string().min(1).max(120).optional(),
  plan: z.enum(["FREE", "BASIC", "STARTER", "LITE", "PRO", "ENTERPRISE"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  phone: z.string().max(30).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: { message: "Forbidden: Admin access required." } }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: { message: "User ID is required" } }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid user update payload" } },
      { status: 400 },
    );
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return NextResponse.json({ error: { message: "User not found" } }, { status: 404 });
  }

  // Admin is decided by the configured address (see src/server/authz.ts), so
  // writing these columns would grant nothing while appearing to succeed —
  // which is the dangerous direction for a privilege control. Reject instead.
  if (typeof parsed.data.isAdmin === "boolean" || parsed.data.role) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_SUPPORTED",
          message:
            "Administrator access is granted by email address, not per-user flags. Set ADMIN_EMAILS in the environment to change who is an admin.",
        },
      },
      { status: 400 },
    );
  }

  const dataToUpdate: Record<string, unknown> = {};
  if (parsed.data.name) {
    dataToUpdate.name = parsed.data.name.trim();
  }
  if (parsed.data.plan) {
    const rawPlan = parsed.data.plan.toUpperCase();
    const cleanPlan = rawPlan === "STARTER" || rawPlan === "BASIC" ? "FREE" : rawPlan;
    dataToUpdate.plan = cleanPlan;
    const newCredits =
      cleanPlan === "ENTERPRISE"
        ? 500000
        : cleanPlan === "PRO"
        ? 100000
        : cleanPlan === "LITE"
        ? 25000
        : 100;
    dataToUpdate.creditsTotal = newCredits;
    dataToUpdate.creditsRemaining = newCredits;
  }
  if (parsed.data.status) {
    dataToUpdate.status = parsed.data.status;
  }
  if (parsed.data.phone !== undefined) {
    dataToUpdate.phone = parsed.data.phone;
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: dataToUpdate as any,
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      role: true,
      plan: true,
      status: true,
      phone: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: updatedUser });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: { message: "Forbidden: Admin access required." } }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: { message: "User ID is required" } }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return NextResponse.json({ error: { message: "User not found" } }, { status: 404 });
  }

  if (targetUser.email.toLowerCase() === currentUser.email.toLowerCase()) {
    return NextResponse.json(
      { error: { message: "You cannot delete your own active administrator account." } },
      { status: 400 },
    );
  }

  // Find memberships and orgs owned by user
  const memberships = await prisma.orgMember.findMany({ where: { userId: id } });
  const orgIds = memberships.map((m) => m.orgId);

  // Clean up user's websites and org data
  for (const orgId of orgIds) {
    const memberCount = await prisma.orgMember.count({ where: { orgId } });
    if (memberCount <= 1) {
      // Sole owner of this organization - cascade delete org and its sites
      const sites = await prisma.website.findMany({ where: { orgId } });
      for (const site of sites) {
        await prisma.pageRecord.deleteMany({ where: { websiteId: site.id } }).catch(() => {});
        await prisma.keyword.deleteMany({ where: { websiteId: site.id } }).catch(() => {});
        await prisma.opportunity.deleteMany({ where: { websiteId: site.id } }).catch(() => {});
        await prisma.content.deleteMany({ where: { websiteId: site.id } }).catch(() => {});
        await prisma.aiPrompt.deleteMany({ where: { websiteId: site.id } }).catch(() => {});
        await prisma.website.delete({ where: { id: site.id } }).catch(() => {});
      }
      await prisma.orgMember.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    } else {
      // Just remove the membership
      await prisma.orgMember.deleteMany({ where: { orgId, userId: id } }).catch(() => {});
    }
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true, deletedUserId: id, message: `Account ${targetUser.email} permanently removed.` });
}

