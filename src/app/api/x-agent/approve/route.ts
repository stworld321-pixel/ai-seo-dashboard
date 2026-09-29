import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { approveXDraft } from "@/server/services/x-agent";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      websiteId?: string;
      opportunityId?: string;
      draftContent?: string;
      status?: "posted" | "approved";
    };

    if (!body.opportunityId || !body.draftContent) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "opportunityId and draftContent are required" } },
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

    const opportunity = await approveXDraft(
      website.id,
      body.opportunityId,
      body.draftContent,
      body.status || "posted",
    );

    return NextResponse.json({
      data: {
        opportunity,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "APPROVE_FAILED", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 },
    );
  }
}
