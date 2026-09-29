import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";

const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  name: z.string().min(1).max(120).optional(),
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]).optional(),
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

  const dataToUpdate: Record<string, unknown> = {};
  if (typeof parsed.data.isAdmin === "boolean") {
    dataToUpdate.isAdmin = parsed.data.isAdmin;
    dataToUpdate.role = parsed.data.isAdmin ? "ADMIN" : "USER";
  }
  if (parsed.data.role) {
    dataToUpdate.role = parsed.data.role;
    dataToUpdate.isAdmin = parsed.data.role === "ADMIN";
  }
  if (parsed.data.name) {
    dataToUpdate.name = parsed.data.name.trim();
  }
  if (parsed.data.plan) {
    dataToUpdate.plan = parsed.data.plan;
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
