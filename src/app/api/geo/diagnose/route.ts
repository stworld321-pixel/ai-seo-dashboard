import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { runGeoDiagnostics } from "@/server/intelligence/geo-engine";
import { prisma } from "@/server/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const result = await runGeoDiagnostics(website.id);

    await prisma.agentLog.create({
      data: {
        websiteId: website.id,
        agent: "geo-agent",
        level: "info",
        message: `GEO Agent diagnostic complete: ${result.totalGaps} gaps evaluated (${result.schemaGaps} schema, ${result.comparisonGaps} comparison, ${result.quickAnswerGaps} quick answers).`,
        data: {
          totalGaps: result.totalGaps,
          schemaGaps: result.schemaGaps,
          comparisonGaps: result.comparisonGaps,
        },
      },
    });

    return NextResponse.json({ data: result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: { message: e instanceof Error ? e.message : "Failed to run GEO diagnostics" } },
      { status: 500 }
    );
  }
}
