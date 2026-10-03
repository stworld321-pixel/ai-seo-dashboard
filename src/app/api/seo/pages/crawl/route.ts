import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite, getPageMetrics, resolveWindow } from "@/server/services/dashboard";
import { fetchUrlResilient, parseHtmlPage } from "@/server/services/ai-site-auditor";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      websiteId?: string;
      url?: string;
      batch?: boolean;
      limit?: number;
    };

    const website = await getDefaultWebsite(body.websiteId);
    if (!website) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Website not found" } },
        { status: 404 },
      );
    }

    let domain = website.url;
    try {
      domain = new URL(website.url).hostname.replace(/^www\./, "");
    } catch {
      // ignore
    }

    // BATCH MODE: Scan top uncrawled GSC pages
    if (body.batch || !body.url) {
      const window = await resolveWindow(website.id, "28d");
      if (!window) {
        return NextResponse.json({
          data: { crawledCount: 0, totalQueued: 0, pageRecords: [] },
          message: "No Search Console data window available.",
        });
      }
      const pages = await getPageMetrics(website.id, window);
      const existingRecords = await prisma.pageRecord.findMany({
        where: { websiteId: website.id },
        select: { url: true, lastCrawledAt: true },
      });
      const crawledUrls = new Set(
        existingRecords.filter((r) => r.lastCrawledAt).map((r) => r.url.replace(/\/+$/, "")),
      );
      const toCrawl = pages
        .filter((p) => !crawledUrls.has(p.page.replace(/\/+$/, "")))
        .slice(0, Math.min(body.limit ?? 25, 50));

      const now = new Date();
      let crawledCount = 0;
      const updatedRecords: any[] = [];

      for (let i = 0; i < toCrawl.length; i += 5) {
        const chunk = toCrawl.slice(i, i + 5);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              const res = await fetchUrlResilient(item.page, 6000);
              if (res.status >= 200 && res.status < 400 && res.body) {
                const parsed = parseHtmlPage(item.page, res.body, domain);
                const rec = await prisma.pageRecord.upsert({
                  where: { websiteId_url: { websiteId: website.id, url: item.page } },
                  create: {
                    websiteId: website.id,
                    url: item.page,
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
                crawledCount++;
                updatedRecords.push(rec);
              }
            } catch {
              // ignore
            }
          }),
        );
      }

      return NextResponse.json({
        data: {
          crawledCount,
          totalQueued: toCrawl.length,
          pageRecords: updatedRecords,
        },
        message: `Successfully audited ${crawledCount} pages.`,
      });
    }

    // Crawl live page
    const res = await fetchUrlResilient(body.url, 10000);
    if (res.status < 200 || res.status >= 400 || !res.body) {
      return NextResponse.json(
        {
          error: {
            code: "FETCH_FAILED",
            message: `Could not fetch live page (${res.status || "unreachable"}). Please verify the URL is publicly accessible.`,
          },
        },
        { status: 400 },
      );
    }

    const parsed = parseHtmlPage(body.url, res.body, domain);
    const now = new Date();

    const isThin = parsed.wordCount < 300;
    const isMissingMeta = !parsed.metaDescription || parsed.metaDescription.trim().length < 20;
    const status = isThin || isMissingMeta ? "OPTIMIZE" : "HEALTHY";

    const updated = await prisma.pageRecord.upsert({
      where: {
        websiteId_url: {
          websiteId: website.id,
          url: body.url,
        },
      },
      create: {
        websiteId: website.id,
        url: body.url,
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
        status,
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
        status,
      },
    });

    return NextResponse.json({
      data: {
        pageRecord: updated,
        parsed,
      },
      message: "Page re-crawled and analyzed successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to crawl page",
        },
      },
      { status: 500 },
    );
  }
}
