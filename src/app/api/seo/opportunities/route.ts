import { NextResponse } from "next/server";
import { getDefaultWebsite, getOpportunities } from "@/server/services/dashboard";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteIdParam = searchParams.get("websiteId");
  const statusParam = searchParams.get("status") as
    | "OPEN"
    | "IN_PROGRESS"
    | "AWAITING_APPROVAL"
    | "DONE"
    | "DISMISSED"
    | "EXPIRED"
    | "ALL"
    | null;

  const website = await getDefaultWebsite(websiteIdParam ?? undefined);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website connected" } },
      { status: 404 },
    );
  }

  const opps = await getOpportunities(website.id, statusParam ?? "OPEN");
  return NextResponse.json({ data: opps });
}
