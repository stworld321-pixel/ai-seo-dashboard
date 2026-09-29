import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { generateArticlePipelineDraft } from "@/server/services/article-agent";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    pipelineId: string;
    provider?: string;
    model?: string;
  };

  if (!body.pipelineId) {
    return NextResponse.json({ error: { message: "pipelineId is required" } }, { status: 400 });
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const updated = await generateArticlePipelineDraft({
      websiteId: website.id,
      pipelineId: body.pipelineId,
      provider: body.provider,
      model: body.model,
    });

    return NextResponse.json({
      data: {
        pipeline: updated,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: { message: e instanceof Error ? e.message : "Failed to generate article draft" } },
      { status: 500 }
    );
  }
}
