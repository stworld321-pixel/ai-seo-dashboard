import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { generateRedditDraft } from "@/server/services/reddit-agent";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    opportunityId: string;
    websiteId?: string;
  };

  if (!body.opportunityId) {
    return NextResponse.json({ error: { message: "opportunityId is required" } }, { status: 400 });
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const updated = await generateRedditDraft(body.opportunityId);
    return NextResponse.json({
      data: {
        opportunity: updated,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: { message: e instanceof Error ? e.message : "Failed to generate Reddit response draft" } },
      { status: 500 }
    );
  }
}
