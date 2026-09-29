import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { getArticleAgentPipelines } from "@/server/services/article-agent";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const pipelines = await getArticleAgentPipelines(website.id);
    return NextResponse.json({
      data: {
        totalPipelines: pipelines.length,
        pipelines,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: { message: e instanceof Error ? e.message : "Failed to scan article pipelines" } },
      { status: 500 }
    );
  }
}
