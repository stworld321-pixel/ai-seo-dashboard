import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { crawlForKeywordResearch, buildBusinessProfile, type BusinessProfile } from "@/server/intelligence/keyword-research";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId");

  const website = await getDefaultWebsite(websiteId ?? undefined);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const { cleanedPages } = await crawlForKeywordResearch(website.url, 15);
    const profile = await buildBusinessProfile({
      websiteId: website.id,
      url: website.url,
      country: website.country || "IND",
      language: "en",
      cleanedPages,
    });

    return NextResponse.json({ data: profile });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Failed to extract business profile" } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    profile?: BusinessProfile;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  if (!body.profile) {
    return NextResponse.json({ error: { message: "Business profile payload is required" } }, { status: 400 });
  }

  try {
    // Save/update any custom competitors or settings
    if (body.profile.competitor_like_terms?.length) {
      for (const comp of body.profile.competitor_like_terms) {
        if (comp && comp.includes(".")) {
          await prisma.aiCompetitor.upsert({
            where: { websiteId_domain: { websiteId: website.id, domain: comp.replace(/^www\./, "") } },
            create: { websiteId: website.id, name: comp, domain: comp.replace(/^www\./, "") },
            update: { name: comp },
          });
        }
      }
    }

    return NextResponse.json({ data: { success: true, profile: body.profile } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Failed to update business profile" } },
      { status: 500 },
    );
  }
}
