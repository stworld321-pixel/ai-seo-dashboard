import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { scanRedditDiscussions } from "@/server/services/reddit-agent";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const opportunities = await scanRedditDiscussions(website.id);
    return NextResponse.json({
      data: {
        totalDiscussions: opportunities.length,
        opportunities,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: { message: e instanceof Error ? e.message : "Failed to scan Reddit discussions" } },
      { status: 500 }
    );
  }
}
