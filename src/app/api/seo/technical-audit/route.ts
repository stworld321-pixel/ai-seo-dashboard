/**
 * POST /api/seo/technical-audit
 *
 * Runs a full technical audit for a website:
 *  1. Page Speed — fetches Google PageSpeed Insights for BOTH mobile AND desktop
 *     for the top pages (by GSC impressions, or PageRecord URLs as fallback)
 *  2. Broken Links — crawls all PageRecord URLs for 4xx / redirect chains
 *  3. Re-computes the health score with Page Speed + Broken Links categories activated
 *  4. Persists results to SeoIssue and HealthScoreSnapshot
 *
 * Body: { websiteId?: string; maxPages?: number }
 *   maxPages defaults to 5 (each page = 2 PSI calls; keep quota friendly)
 *
 * GET returns the last stored Page Speed + Broken Links issues.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  getDefaultWebsite,
  getOpportunities,
  getPageMetrics,
  getQueryMetrics,
  resolveWindow,
} from "@/server/services/dashboard";
import { computeHealthScore } from "@/server/intelligence/health-score";
import { fetchPSI, type PageSpeedData } from "@/server/intelligence/page-speed";
import { checkUrlsBatch } from "@/server/intelligence/broken-links";
import type { Opportunity } from "@/lib/types";

import { crawlPublicWebsite, ensureWebsiteAudited, fetchUrlResilient, parseHtmlPage } from "@/server/services/ai-site-auditor";

// Allow up to 5 minutes — PSI alone can take 30-45s per page × 2 strategies
export const maxDuration = 300;

const DEFAULT_MAX_PAGES = 5;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    maxPages?: number;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website found" } },
      { status: 404 },
    );
  }

  const maxPages = Math.min(body.maxPages ?? DEFAULT_MAX_PAGES, 20);

  // 1. Refresh live crawl of public website pages to ensure latest HTML, schema & meta tags are synced
  try {
    const { pages: freshPages, domain } = await crawlPublicWebsite(website.url);
    const now = new Date();
    for (let idx = 0; idx < freshPages.length; idx++) {
      const cp = freshPages[idx]!;
      await prisma.pageRecord.upsert({
        where: { websiteId_url: { websiteId: website.id, url: cp.url } },
        create: {
          websiteId: website.id,
          url: cp.url,
          title: cp.title,
          h1: cp.h1,
          metaDescription: cp.metaDescription,
          wordCount: cp.wordCount,
          indexState: "PASS",
          canonical: cp.canonical,
          isOrphan: idx > 3 && cp.internalLinks < 3,
          contentScore: cp.contentScore,
          contentScoreDetail: {
            focusKeyword: cp.focusKeyword,
            internalLinks: cp.internalLinks,
            externalLinks: cp.externalLinks,
            hasSchema: cp.hasSchema,
            schemaTypes: cp.schemaTypes,
          },
          lastCrawledAt: now,
          status: !cp.metaDescription || cp.wordCount < 300 ? "OPTIMIZE" : "HEALTHY",
        },
        update: {
          title: cp.title,
          h1: cp.h1,
          metaDescription: cp.metaDescription,
          canonical: cp.canonical,
          wordCount: cp.wordCount,
          contentScore: cp.contentScore,
          contentScoreDetail: {
            focusKeyword: cp.focusKeyword,
            internalLinks: cp.internalLinks,
            externalLinks: cp.externalLinks,
            hasSchema: cp.hasSchema,
            schemaTypes: cp.schemaTypes,
          },
          lastCrawledAt: now,
          status: !cp.metaDescription || cp.wordCount < 300 ? "OPTIMIZE" : "HEALTHY",
        },
      });
    }

    // Re-crawl ALL existing DB pages to ensure accurate metadata extraction
    const crawledUrls = new Set(freshPages.map((p) => p.url));
    const uncrawledDbPages = await prisma.pageRecord.findMany({
      where: { websiteId: website.id, url: { notIn: Array.from(crawledUrls) } },
      take: 50,
    });
    // Process in batches of 5 to avoid overwhelming the target server
    for (let batch = 0; batch < uncrawledDbPages.length; batch += 5) {
      const chunk = uncrawledDbPages.slice(batch, batch + 5);
      await Promise.all(
        chunk.map(async (uRec) => {
          try {
            const res = await fetchUrlResilient(uRec.url, 8000);
            if (res.status >= 200 && res.status < 400 && res.body) {
              const parsed = parseHtmlPage(uRec.url, res.body, domain);
              await prisma.pageRecord.update({
                where: { id: uRec.id },
                data: {
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
            // ignore unreachable page
          }
        }),
      );
    }

    // Also include top ranking Search Console URLs that haven't been crawled yet
    const gscPages = await prisma.gscPageDaily.findMany({
      where: { websiteId: website.id },
      distinct: ["page"],
      select: { page: true },
      take: 40,
    });
    for (const gp of gscPages) {
      if (!crawledUrls.has(gp.page) && !uncrawledDbPages.some((u) => u.url === gp.page)) {
        try {
          const res = await fetchUrlResilient(gp.page, 6000);
          if (res.status >= 200 && res.status < 400 && res.body) {
            const parsed = parseHtmlPage(gp.page, res.body, domain);
            await prisma.pageRecord.upsert({
              where: { websiteId_url: { websiteId: website.id, url: gp.page } },
              create: {
                websiteId: website.id,
                url: gp.page,
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
            crawledUrls.add(gp.page);
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // Non-fatal crawl fallback
  }

  let w = await resolveWindow(website.id, "28d");
  if (!w) {
    await ensureWebsiteAudited(website.id);
    w = await resolveWindow(website.id, "28d");
  }

  const effectiveDate = w ? w.to : new Date();

  // ── 2. Gather top pages ──────────────────────────────────────────────────
  let [queries, pages, opps, allPageRecords] = await Promise.all([
    w ? getQueryMetrics(website.id, w) : Promise.resolve([]),
    w ? getPageMetrics(website.id, w) : Promise.resolve([]),
    getOpportunities(website.id),
    prisma.pageRecord.findMany({ where: { websiteId: website.id } }),
  ]);

  // Top-impression pages first; fall back to PageRecord URLs
  const topPageUrls: string[] = pages.length > 0
    ? pages.slice(0, maxPages).map((p) => p.page)
    : allPageRecords.slice(0, maxPages).map((r) => r.url);

  // ── 2. Page Speed Insights (mobile + desktop in parallel) ─────────────────
  const psiKey = process.env.GOOGLE_PSI_API_KEY?.trim();
  const pageSpeedData: PageSpeedData[] = [];
  const pageSpeedErrors: { url: string; strategy: string; reason: string }[] = [];

  if (psiKey && topPageUrls.length > 0) {
    // Build a flat list of [url, strategy] pairs — both per page
    const jobs: Array<{ url: string; strategy: "mobile" | "desktop" }> = [];
    for (const url of topPageUrls) {
      jobs.push({ url, strategy: "mobile" });
      jobs.push({ url, strategy: "desktop" });
    }

    // Process with concurrency=3 to respect PSI quota (25k/day free)
    const CONCURRENCY = 3;
    let idx = 0;

    async function psiWorker() {
      while (idx < jobs.length) {
        const i = idx++;
        const job = jobs[i]!;
        try {
          const data = await fetchPSI(job.url, job.strategy, psiKey);
          if (data) {
            pageSpeedData.push(data);
          } else {
            pageSpeedErrors.push({ url: job.url, strategy: job.strategy, reason: "PSI returned empty response" });
          }
        } catch (e) {
          pageSpeedErrors.push({
            url: job.url,
            strategy: job.strategy,
            reason: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, psiWorker),
    );
  }

  // ── 3. Broken Link Check ─────────────────────────────────────────────────
  const allUrlsToCheck = allPageRecords.slice(0, 100).map((r) => r.url);
  const brokenLinkResults = allUrlsToCheck.length > 0
    ? await checkUrlsBatch(allUrlsToCheck, { concurrency: 8, timeoutMs: 12_000 })
    : [];

  // ── 4. Compute health score with all categories active ───────────────────
  const mappedOpps: Opportunity[] = opps.map((o) => ({
    type: o.type,
    keyword: o.keyword ?? undefined,
    targetUrl: o.targetUrl ?? undefined,
    score: o.score,
    priority: o.priority,
    estimatedClicks: o.estimatedClicks,
    why: o.why,
    evidence: o.evidence as Record<string, string | number | null>,
    recommendation: o.recommendation as { action: string; detail?: string }[],
  }));

  // Re-load page records AFTER the fresh crawl to ensure health score uses latest extracted metadata
  allPageRecords = await prisma.pageRecord.findMany({ where: { websiteId: website.id } });

  const health = computeHealthScore({
    queries,
    pages,
    opportunities: mappedOpps,
    pageRecords: allPageRecords,
    pageSpeedData: pageSpeedData.length > 0 ? pageSpeedData : undefined,
    brokenLinkResults: brokenLinkResults.length > 0 ? brokenLinkResults : undefined,
  });

  // ── 5. Persist results ───────────────────────────────────────────────────
  await prisma.healthScoreSnapshot.upsert({
    where: { websiteId_date: { websiteId: website.id, date: effectiveDate } },
    create: { websiteId: website.id, date: effectiveDate, total: health.total, breakdown: health.breakdown },
    update: { total: health.total, breakdown: health.breakdown },
  });

  await prisma.seoIssue.deleteMany({ where: { websiteId: website.id, status: "open" } });
  for (const issue of health.issues) {
    await prisma.seoIssue.create({
      data: {
        websiteId: website.id,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        url: issue.url,
        detail: issue.detail,
        status: "open",
      },
    });
  }

  // Log
  await prisma.agentLog.create({
    data: {
      websiteId: website.id,
      agent: "technical-auditor",
      level: "info",
      message: `Technical audit complete: health score ${health.total}/100, ${health.issues.length} issues. PSI: ${pageSpeedData.length} results (${pageSpeedErrors.length} errors). Links: ${allUrlsToCheck.length} checked.`,
      data: {
        healthScore: health.total,
        issuesTotal: health.issues.length,
        pageSpeedResults: pageSpeedData.length,
        pageSpeedErrors: pageSpeedErrors.length,
        brokenLinksChecked: allUrlsToCheck.length,
        psiKey: Boolean(psiKey),
      },
    },
  });

  // Build per-page summary for the response
  const pageScores: Record<string, { mobile: number | null; desktop: number | null }> = {};
  for (const d of pageSpeedData) {
    if (!pageScores[d.url]) pageScores[d.url] = { mobile: null, desktop: null };
    pageScores[d.url]![d.strategy] = d.performanceScore;
  }

  // Build per-page crawled metadata summary for verification
  const crawledPageMeta = allPageRecords.map((r) => ({
    url: r.url,
    title: r.title,
    metaDescription: r.metaDescription,
    h1: r.h1,
    wordCount: r.wordCount,
    canonical: r.canonical,
    lastCrawledAt: r.lastCrawledAt,
    status: r.status,
  }));

  return NextResponse.json({
    data: {
      health,
      audit: {
        pageSpeed: {
          hasPsiKey: Boolean(psiKey),
          pagesChecked: topPageUrls.length,
          resultsReturned: pageSpeedData.length,
          errors: pageSpeedErrors,
          perPage: pageScores,
        },
        brokenLinks: {
          urlsChecked: allUrlsToCheck.length,
          results: brokenLinkResults.map((r) => ({
            url: r.url,
            status: r.status,
            redirectHops: r.redirectHops,
            error: r.error ?? null,
          })),
        },
        crawledPages: crawledPageMeta,
      },
    },
    meta: { websiteId: website.id, issuesStored: health.issues.length },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website found" } },
      { status: 404 },
    );
  }

  const [pageSpeedIssues, brokenLinkIssues, snapshot] = await Promise.all([
    prisma.seoIssue.findMany({
      where: { websiteId: website.id, category: "Page Speed", status: "open" },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
    }),
    prisma.seoIssue.findMany({
      where: { websiteId: website.id, category: "Broken Links", status: "open" },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
    }),
    prisma.healthScoreSnapshot.findFirst({
      where: { websiteId: website.id },
      orderBy: { date: "desc" },
    }),
  ]);

  return NextResponse.json({
    data: { pageSpeedIssues, brokenLinkIssues, lastAuditScore: snapshot?.total ?? null, lastAuditDate: snapshot?.date ?? null },
    meta: { websiteId: website.id },
  });
}
