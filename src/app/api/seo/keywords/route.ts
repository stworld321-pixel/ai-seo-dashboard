import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { classifyIntent, positionBand } from "@/server/intelligence/intent";
import { fetchGoogleSerpData } from "@/server/services/google-serp";
import { getCurrentUser } from "@/server/auth";
import { deductCredits, CREDIT_COSTS } from "@/server/services/credits";

import { isStoplistedKeyword, HARD_STOPLIST } from "@/server/intelligence/keyword-research";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteIdParam = searchParams.get("websiteId");
  const isCustomParam = searchParams.get("isCustom");
  const bandParam = searchParams.get("band");
  const intentParam = searchParams.get("intent");
  const searchParam = searchParams.get("q")?.toLowerCase();

  const website = await getDefaultWebsite(websiteIdParam ?? undefined);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website found" } },
      { status: 404 },
    );
  }

  // Purge any lingering stoplisted records from the database
  try {
    await prisma.keyword.deleteMany({
      where: {
        websiteId: website.id,
        query: { in: Array.from(HARD_STOPLIST) },
      },
    });
  } catch {
    // non-fatal
  }

  const where: {
    websiteId: string;
    isCustom?: boolean;
    intent?: "INFORMATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | "NAVIGATIONAL" | "LOCAL";
    query?: { contains: string; mode?: "insensitive" };
  } = {
    websiteId: website.id,
  };

  if (isCustomParam === "true") {
    where.isCustom = true;
  } else if (isCustomParam === "false") {
    where.isCustom = false;
  }

  if (intentParam) {
    where.intent = intentParam.toUpperCase() as any;
  }

  if (searchParam) {
    where.query = { contains: searchParam, mode: "insensitive" };
  }

  const keywords = await prisma.keyword.findMany({
    where,
    orderBy: [{ isCustom: "desc" }, { clicks28: "desc" }, { impressions28: "desc" }],
  });

  const enriched = keywords
    .filter((k) => !isStoplistedKeyword(k.query))
    .map((k) => ({
      ...k,
      band: positionBand(k.liveRank ?? k.position28 ?? 999),
    }));

  const filtered = bandParam ? enriched.filter((k) => k.band === bandParam) : enriched;

  return NextResponse.json({ data: filtered });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    keywords?: string[] | string;
    targetUrl?: string;
    targetPosition?: number;
    tags?: string[];
    country?: string;
    checkSerpNow?: boolean;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website found" } },
      { status: 404 },
    );
  }

  const rawKeywords: string[] = Array.isArray(body.keywords)
    ? body.keywords
    : typeof body.keywords === "string"
      ? body.keywords.split(/[,\n]/).map((k) => k.trim()).filter(Boolean)
      : [];

  if (rawKeywords.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "At least one keyword is required" } },
      { status: 400 },
    );
  }

  const currentUser = await getCurrentUser();
  if (currentUser) {
    const cost = rawKeywords.length * CREDIT_COSTS.KEYWORD_SEARCH;
    const deduction = await deductCredits({
      userId: currentUser.id,
      amount: cost,
      reason: `Keyword research for ${rawKeywords.length} queries (${cost} credits)`,
    });
    if (!deduction.success) {
      return NextResponse.json(
        { error: { code: "INSUFFICIENT_CREDITS", message: deduction.error } },
        { status: 402 },
      );
    }
  }

  const country = body.country || "in";
  const createdKeywords = [];

  for (const rawKw of rawKeywords) {
    const kw = rawKw.trim();
    if (!kw || isStoplistedKeyword(kw)) continue;

    const { intent, confidence } = classifyIntent(kw);

    let serpData: any = null;
    let liveRank: number | null = null;
    let liveRankUrl: string | null = null;

    if (body.checkSerpNow !== false) {
      try {
        const serp = await fetchGoogleSerpData({
          keyword: kw,
          targetDomain: website.url,
          country,
          websiteId: website.id,
        });
        serpData = serp;
        liveRank = serp.rank;
        liveRankUrl = serp.rankingUrl;
      } catch {
        // non-fatal
      }
    }

    const record = await prisma.keyword.upsert({
      where: {
        websiteId_query: {
          websiteId: website.id,
          query: kw,
        },
      },
      create: {
        websiteId: website.id,
        query: kw,
        intent,
        intentConfidence: confidence,
        isCustom: true,
        tags: body.tags ?? [],
        targetUrl: body.targetUrl ?? null,
        targetPosition: body.targetPosition ?? 1,
        liveRank,
        liveRankUrl,
        lastCheckedAt: serpData ? new Date() : null,
        serpData: serpData ?? undefined,
        opportunityScore: serpData?.opportunityScore ?? 65,
      },
      update: {
        isCustom: true,
        tags: body.tags?.length ? body.tags : undefined,
        targetUrl: body.targetUrl ?? undefined,
        targetPosition: body.targetPosition ?? undefined,
        ...(serpData
          ? {
              liveRank,
              liveRankUrl,
              lastCheckedAt: new Date(),
              serpData,
              opportunityScore: serpData.opportunityScore,
            }
          : {}),
      },
    });

    createdKeywords.push(record);
  }

  // Recompute website opportunities to instantly expose the new custom keywords in Opportunities dashboard
  const { recomputeWebsiteOpportunities } = await import("@/server/services/dashboard");
  await recomputeWebsiteOpportunities(website.id).catch(() => {});

  await prisma.agentLog.create({
    data: {
      websiteId: website.id,
      agent: "keyword-tracker",
      level: "info",
      message: `Added and tracked ${createdKeywords.length} custom keyword(s): ${rawKeywords.slice(0, 3).join(", ")}${rawKeywords.length > 3 ? "..." : ""}.`,
    },
  });

  return NextResponse.json({
    data: {
      success: true,
      count: createdKeywords.length,
      keywords: createdKeywords,
    },
  });
}
