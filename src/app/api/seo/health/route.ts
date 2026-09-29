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
import { ensureWebsiteAudited } from "@/server/services/ai-site-auditor";
import type { Opportunity } from "@/lib/types";

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

  let w = await resolveWindow(website.id, "28d");
  if (!w) {
    await ensureWebsiteAudited(website.id);
    w = await resolveWindow(website.id, "28d");
  }

  const [queries, pages, opps, pageRecords] = w
    ? await Promise.all([
        getQueryMetrics(website.id, w),
        getPageMetrics(website.id, w),
        getOpportunities(website.id),
        prisma.pageRecord.findMany({ where: { websiteId: website.id } }),
      ])
    : [[], [], [], []];

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

  const health = computeHealthScore({
    queries,
    pages,
    opportunities: mappedOpps,
    pageRecords,
  });

  return NextResponse.json({
    data: health,
    meta: { websiteId: website.id },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { websiteId?: string };
  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website found" } },
      { status: 404 },
    );
  }

  let w = await resolveWindow(website.id, "28d");
  if (!w) {
    await ensureWebsiteAudited(website.id);
    w = await resolveWindow(website.id, "28d");
  }

  const effectiveDate = w ? w.to : new Date();

  const [queries, pages, opps, pageRecords] = await Promise.all([
    w ? getQueryMetrics(website.id, w) : Promise.resolve([]),
    w ? getPageMetrics(website.id, w) : Promise.resolve([]),
    getOpportunities(website.id),
    prisma.pageRecord.findMany({ where: { websiteId: website.id } }),
  ]);

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

  const health = computeHealthScore({
    queries,
    pages,
    opportunities: mappedOpps,
    pageRecords,
  });

  await prisma.healthScoreSnapshot.upsert({
    where: { websiteId_date: { websiteId: website.id, date: effectiveDate } },
    create: {
      websiteId: website.id,
      date: effectiveDate,
      total: health.total,
      breakdown: health.breakdown,
    },
    update: {
      total: health.total,
      breakdown: health.breakdown,
    },
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

  return NextResponse.json({
    data: health,
    meta: { websiteId: website.id, issuesStored: health.issues.length },
  });
}
