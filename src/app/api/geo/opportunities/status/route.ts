import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    opportunityId: string;
    websiteId?: string;
    status: "open" | "done" | "dismissed";
  };

  if (!body.opportunityId || !body.status) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "opportunityId and status are required" } },
      { status: 400 },
    );
  }

  const opp = await prisma.geoOpportunity.findUnique({
    where: { id: body.opportunityId },
  });

  if (!opp) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "GEO opportunity not found" } },
      { status: 404 },
    );
  }

  const updated = await prisma.geoOpportunity.update({
    where: { id: body.opportunityId },
    data: { status: body.status },
  });

  return NextResponse.json({
    data: {
      opportunity: updated,
      status: updated.status,
    },
  });
}
