import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { canAccessWebsite } from "@/server/auth";

/** Same 404 whether the record is missing or belongs to another tenant. */
const notFound = () =>
  NextResponse.json({ error: { code: "NOT_FOUND", message: "Opportunity not found" } }, { status: 404 });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: { website: true },
  });

  if (!opp) return notFound();
  if (!(await canAccessWebsite(opp.websiteId))) return notFound();

  // Find any linked content / approvals
  const approvals = await prisma.approval.findMany({
    where: {
      websiteId: opp.websiteId,
      status: "pending",
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: { opportunity: opp, approvals } });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: "OPEN" | "IN_PROGRESS" | "AWAITING_APPROVAL" | "DONE" | "DISMISSED" | "EXPIRED";
    priority?: number;
  };

  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) return notFound();
  if (!(await canAccessWebsite(existing.websiteId))) return notFound();

  const updated = await prisma.opportunity.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.priority ? { priority: body.priority } : {}),
      ...(body.status === "DONE" || body.status === "DISMISSED"
        ? { resolvedAt: new Date() }
        : {}),
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) return notFound();
  if (!(await canAccessWebsite(existing.websiteId))) return notFound();

  await prisma.opportunity.delete({ where: { id } });
  return NextResponse.json({ data: { success: true, id } });
}
