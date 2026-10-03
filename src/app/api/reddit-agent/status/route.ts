import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    opportunityId: string;
    status: "new" | "posted" | "dismissed";
  };

  if (!body.opportunityId || !body.status) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "opportunityId and status are required" } },
      { status: 400 },
    );
  }

  const opp = await prisma.redditOpportunity.findUnique({
    where: { id: body.opportunityId },
  });

  if (!opp) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Reddit opportunity not found" } },
      { status: 404 },
    );
  }

  const updated = await prisma.redditOpportunity.update({
    where: { id: body.opportunityId },
    data: {
      status: body.status,
      ...(body.status === "posted" ? { approvedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({
    data: {
      opportunity: updated,
      status: updated.status,
    },
  });
}
