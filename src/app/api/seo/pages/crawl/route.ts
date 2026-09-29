import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { fetchUrlResilient, parseHtmlPage } from "@/server/services/ai-site-auditor";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      websiteId?: string;
      url?: string;
    };

    if (!body.url) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "URL is required" } },
        { status: 400 },
      );
    }

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
