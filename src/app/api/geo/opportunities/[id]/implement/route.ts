import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { generateGeoFix } from "@/server/intelligence/geo-engine";
import { getDefaultWebsite } from "@/server/services/dashboard";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    action?: "generate_preview" | "save_content" | "mark_done" | "dismiss";
  };

  const opp = await prisma.geoOpportunity.findUnique({
    where: { id },
    include: { website: true },
  });

  if (!opp) {
    return NextResponse.json({ error: { message: "GEO Opportunity not found" } }, { status: 404 });
  }

  const website = await getDefaultWebsite(body.websiteId || opp.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  if (body.action === "dismiss") {
    await prisma.geoOpportunity.update({
      where: { id },
      data: { status: "dismissed" },
    });
    return NextResponse.json({ data: { id, status: "dismissed" } });
  }

  try {
    const fix = await generateGeoFix(id);

    if (body.action === "mark_done") {
      await prisma.geoOpportunity.update({
        where: { id },
        data: { status: "done" },
      });

      // Also save into Content Library for reference
      await prisma.content.create({
        data: {
          websiteId: website.id,
          type: fix.fixType === "schema" ? "SCHEMA" : fix.fixType === "faq" ? "FAQ" : "PRODUCT_COPY",
          title: fix.title,
          body: fix.codeSnippet,
          status: "APPROVED",
          authorAgent: "geo-agent",
        },
      });

      await prisma.agentLog.create({
        data: {
          websiteId: website.id,
          agent: "geo-agent",
          level: "info",
          message: `GEO Optimization implemented: "${fix.title}" marked as done and saved to Content Library.`,
          data: {
            opportunityId: id,
            fixType: fix.fixType,
          },
        },
      });
    }

    return NextResponse.json({
      data: {
        id,
        status: body.action === "mark_done" ? "done" : opp.status,
        fix,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: { message: e instanceof Error ? e.message : "Failed to implement GEO fix" } },
      { status: 500 }
    );
  }
}
