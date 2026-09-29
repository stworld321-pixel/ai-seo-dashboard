import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { fetchGoogleSerpData } from "@/server/services/google-serp";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    keywordId?: string;
    keyword?: string;
    country?: string;
    pagesToCheck?: number;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website connected" } },
      { status: 404 },
    );
  }

  let query = (body.keyword ?? "").trim();
  let keywordRecord = null;

  if (body.keywordId) {
    keywordRecord = await prisma.keyword.findUnique({
      where: { id: body.keywordId },
    });
    if (keywordRecord) {
      query = keywordRecord.query;
    }
  }

  if (!query) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Keyword is required" } },
      { status: 400 },
    );
  }

  const country = body.country || "in";
  const pagesToCheck = body.pagesToCheck ? Number(body.pagesToCheck) : 5;

  const serp = await fetchGoogleSerpData({
    keyword: query,
    targetDomain: website.url,
    country,
    pagesToCheck,
    websiteId: website.id,
  });

  const now = new Date();

  // Update or upsert the keyword record with the fresh SERP data
  const updated = await prisma.keyword.upsert({
    where: {
      websiteId_query: {
        websiteId: website.id,
        query,
      },
    },
    create: {
      websiteId: website.id,
      query,
      isCustom: true,
      liveRank: serp.rank,
      liveRankUrl: serp.rankingUrl,
      lastCheckedAt: now,
      serpData: serp as any,
      opportunityScore: serp.opportunityScore,
    },
    update: {
      liveRank: serp.rank,
      liveRankUrl: serp.rankingUrl,
      lastCheckedAt: now,
      serpData: serp as any,
      opportunityScore: serp.opportunityScore,
    },
  });

  await prisma.agentLog.create({
    data: {
      websiteId: website.id,
      agent: "serp-monitor",
      level: "info",
      message: `Checked Google SERP for "${query}" — Domain Rank: ${serp.rank ? `#${serp.rank}` : "Outside Top 50"}.`,
    },
  });

  return NextResponse.json({
    data: {
      keyword: updated,
      serp,
    },
  });
}
