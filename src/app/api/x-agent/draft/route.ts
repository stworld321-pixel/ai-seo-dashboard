import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { generateXDraft } from "@/server/services/x-agent";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      websiteId?: string;
      opportunityId?: string;
    };

    if (!body.opportunityId) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "opportunityId is required" } },
        { status: 400 },
      );
    }

    const website = await getDefaultWebsite(body.websiteId);
    if (!website) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Website not found" } },
        { status: 404 },
      );
    }

    const opportunity = await generateXDraft(website.id, body.opportunityId);

    return NextResponse.json({
      data: {
        opportunity,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "DRAFT_FAILED", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 },
    );
  }
}
