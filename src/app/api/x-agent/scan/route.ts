import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { scanXOpportunities } from "@/server/services/x-agent";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { websiteId?: string };
    const website = await getDefaultWebsite(body.websiteId);
    if (!website) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Website not found" } },
        { status: 404 },
      );
    }

    const opportunities = await scanXOpportunities(website.id);

    return NextResponse.json({
      data: {
        totalOpportunities: opportunities.length,
        opportunities,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SCAN_FAILED", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 },
    );
  }
}
