import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite, getQueryMetrics, resolveWindow } from "@/server/services/dashboard";
import { discoverPrompts } from "@/server/intelligence/prompt-discovery";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    autoSave?: boolean;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const window = await resolveWindow(website.id, "28d");
  const [queries, pages] = await Promise.all([
    window ? getQueryMetrics(website.id, window) : [],
    prisma.pageRecord.findMany({ where: { websiteId: website.id }, take: 20 }),
  ]);

  const topQueries = queries.slice(0, 20).map((q) => ({
    query: q.query,
    impressions: q.impressions,
    position: q.position,
  }));

  const discovered = discoverPrompts({
    websiteName: website.name,
    websiteUrl: website.url,
    location: website.country === "IND" ? "India" : website.country,
    topQueries,
    pages: pages.map((p) => ({ url: p.url, title: p.title })),
  });

  if (body.autoSave) {
    for (const p of discovered) {
      await prisma.aiPrompt.upsert({
        where: {
          websiteId_text: {
            websiteId: website.id,
            text: p.text,
          },
        },
        create: {
          websiteId: website.id,
          text: p.text,
          intent: p.intent,
          priority: p.priority,
          source: p.source,
          approved: false, // Discovered prompts start as unapproved until user clicks approve
          status: "active",
        },
        update: {
          intent: p.intent,
          priority: p.priority,
        },
      });
    }
  }

  return NextResponse.json({
    data: {
      discovered,
      count: discovered.length,
    },
  });
}
