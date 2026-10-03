import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite, resolveWindow } from "@/server/services/dashboard";
import { fetchUrlResilient, parseHtmlPage } from "@/server/services/ai-site-auditor";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const websiteIdParam = searchParams.get("websiteId");

    if (!url) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "URL is required" } },
        { status: 400 },
      );
    }

    const website = await getDefaultWebsite(websiteIdParam || undefined);
    if (!website) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Website not found" } },
        { status: 404 },
      );
    }

    const window = await resolveWindow(website.id, "28d");

    // Fetch page record with flexible normalization
    const normalizedUrl = url.replace(/\/+$/, "");
    let decodedUrl = url;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch {}
    const decodedNorm = decodedUrl.replace(/\/+$/, "");

    let pageRecord = await prisma.pageRecord.findFirst({
      where: {
        websiteId: website.id,
        OR: [
          { url: url },
          { url: normalizedUrl },
          { url: `${normalizedUrl}/` },
          { url: decodedUrl },
          { url: decodedNorm },
          { url: `${decodedNorm}/` },
        ],
      },
    });

    // If never crawled yet, perform on-the-fly live crawl so real metadata is returned
    if (!pageRecord || !pageRecord.lastCrawledAt) {
      try {
        let domain = website.url;
        try {
          domain = new URL(website.url).hostname.replace(/^www\./, "");
        } catch {}
        const res = await fetchUrlResilient(url, 6000);
        if (res.status >= 200 && res.status < 400 && res.body) {
          const parsed = parseHtmlPage(url, res.body, domain);
          const now = new Date();
          pageRecord = await prisma.pageRecord.upsert({
            where: {
              websiteId_url: {
                websiteId: website.id,
                url,
              },
            },
            create: {
              websiteId: website.id,
              url,
              title: parsed.title,
              h1: parsed.h1,
              metaDescription: parsed.metaDescription,
              canonical: parsed.canonical,
              wordCount: parsed.wordCount,
              contentScore: parsed.contentScore,
              contentScoreDetail: {
                focusKeyword: parsed.focusKeyword,
                internalLinks: parsed.internalLinks,
                externalLinks: parsed.externalLinks,
                hasSchema: parsed.hasSchema,
                schemaTypes: parsed.schemaTypes,
              },
              lastCrawledAt: now,
              status: !parsed.metaDescription || parsed.wordCount < 300 ? "OPTIMIZE" : "HEALTHY",
            },
            update: {
              title: parsed.title,
              h1: parsed.h1,
              metaDescription: parsed.metaDescription,
              canonical: parsed.canonical,
              wordCount: parsed.wordCount,
              contentScore: parsed.contentScore,
              contentScoreDetail: {
                focusKeyword: parsed.focusKeyword,
                internalLinks: parsed.internalLinks,
                externalLinks: parsed.externalLinks,
                hasSchema: parsed.hasSchema,
                schemaTypes: parsed.schemaTypes,
              },
              lastCrawledAt: now,
              status: !parsed.metaDescription || parsed.wordCount < 300 ? "OPTIMIZE" : "HEALTHY",
            },
          });
        }
      } catch {
        // Fall back gracefully if site is temporarily slow or unreachable
      }
    }

    // Fetch ranking queries from GscQueryPageDaily
    let queries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }> = [];

    if (window) {
      const gscRows = await prisma.gscQueryPageDaily.findMany({
        where: {
          websiteId: website.id,
          page: { in: [url, normalizedUrl, `${normalizedUrl}/`] },
          date: { gte: window.from, lte: window.to },
        },
        select: { query: true, clicks: true, impressions: true, position: true },
      });

      const acc = new Map<
        string,
        { clicks: number; impressions: number; weighted: number }
      >();
      for (const r of gscRows) {
        const cur = acc.get(r.query) ?? { clicks: 0, impressions: 0, weighted: 0 };
        cur.clicks += r.clicks;
        cur.impressions += r.impressions;
        cur.weighted += r.position * r.impressions;
        acc.set(r.query, cur);
      }

      queries = [...acc.entries()]
        .map(([q, v]) => ({
          query: q,
          clicks: v.clicks,
          impressions: v.impressions,
          ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
          position: v.impressions > 0 ? v.weighted / v.impressions : 0,
        }))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 15);
    }

    // Fetch associated opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: {
        websiteId: website.id,
        targetUrl: { in: [url, normalizedUrl, `${normalizedUrl}/`] },
      },
      orderBy: { priority: "asc" },
    });

    // Fetch internal link suggestions
    const linkSuggestions = await prisma.internalLinkSuggestion.findMany({
      where: {
        websiteId: website.id,
        OR: [
          { sourceUrl: { in: [url, normalizedUrl, `${normalizedUrl}/`] } },
          { targetUrl: { in: [url, normalizedUrl, `${normalizedUrl}/`] } },
        ],
      },
      take: 10,
    });

    return NextResponse.json({
      data: {
        url,
        website: { id: website.id, name: website.name, url: website.url },
        pageRecord,
        queries,
        opportunities,
        linkSuggestions,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to load page details",
        },
      },
      { status: 500 },
    );
  }
}
