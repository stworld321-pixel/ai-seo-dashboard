import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  getDefaultWebsite,
  recomputeWebsiteOpportunities,
  resolveWindow,
} from "@/server/services/dashboard";
import { computeHealthScore } from "@/server/intelligence/health-score";
import { generateInternalLinkSuggestions } from "@/server/intelligence/internal-links";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    ruleId?: string;
    toggleRuleId?: string;
    enabled?: boolean;
  };

  if (body.toggleRuleId !== undefined && typeof body.enabled === "boolean") {
    const updated = await prisma.automationRule.update({
      where: { id: body.toggleRuleId },
      data: { enabled: body.enabled },
    });
    return NextResponse.json({ data: updated });
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website found" } },
      { status: 404 },
    );
  }

  const startedAt = new Date();
  let rule = body.ruleId
    ? await prisma.automationRule.findUnique({ where: { id: body.ruleId } })
    : await prisma.automationRule.findFirst({ where: { websiteId: website.id } });

  if (!rule) {
    rule = await prisma.automationRule.create({
      data: {
        websiteId: website.id,
        name: "Daily Search Console Sync & Opportunity Detection",
        kind: "daily-seo",
        enabled: true,
        schedule: "0 8 * * *",
        config: { windowDays: 28, topActionsLimit: 5 },
      },
    });
  }

  const { opportunities, queries, pages } = await recomputeWebsiteOpportunities(
    website.id,
    "28d",
  );

  // Pull live WordPress catalog, Rank Math metadata & link graph, WooCommerce orders, and Google Site Kit GA4 telemetry
  try {
    const { syncLiveWordPressCatalogAndTelemetry } = await import(
      "@/server/services/wordpress-sync"
    );
    await syncLiveWordPressCatalogAndTelemetry({
      websiteId: website.id,
      siteUrl: website.url,
    });
  } catch {
    // Non-fatal if WordPress is temporarily unreachable
  }

  await prisma.syncCursor.updateMany({
    where: { websiteId: website.id },
    data: { lastRunAt: startedAt, lastStatus: "ok" },
  });
  await prisma.integration.updateMany({
    where: { websiteId: website.id },
    data: { lastSyncAt: startedAt, status: "ACTIVE" },
  });

  const pageRecords = await prisma.pageRecord.findMany({ where: { websiteId: website.id } });
  const health = computeHealthScore({
    queries,
    pages,
    opportunities,
    pageRecords,
  });

  const w = await resolveWindow(website.id, "28d");
  if (w) {
    await prisma.healthScoreSnapshot.upsert({
      where: { websiteId_date: { websiteId: website.id, date: w.to } },
      create: {
        websiteId: website.id,
        date: w.to,
        total: health.total,
        breakdown: health.breakdown,
      },
      update: {
        total: health.total,
        breakdown: health.breakdown,
      },
    });
  }

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

  const linkSuggestions = generateInternalLinkSuggestions({
    pages,
    queries,
    opportunities,
  });
  for (const s of linkSuggestions) {
    await prisma.internalLinkSuggestion.upsert({
      where: {
        websiteId_sourceUrl_targetUrl_anchor: {
          websiteId: website.id,
          sourceUrl: s.sourceUrl,
          targetUrl: s.targetUrl,
          anchor: s.anchor,
        },
      },
      create: {
        websiteId: website.id,
        sourceUrl: s.sourceUrl,
        targetUrl: s.targetUrl,
        anchor: s.anchor,
        reason: s.reason,
        confidence: s.confidence,
        status: "suggested",
      },
      update: {
        reason: s.reason,
        confidence: s.confidence,
      },
    });
  }

  const finishedAt = new Date();
  const task = await prisma.agentTask.create({
    data: {
      websiteId: website.id,
      agent: "seo-analyst",
      kind: rule.kind,
      input: { ruleId: rule.id, range: "28d" },
      output: {
        queriesAnalyzed: queries.length,
        pagesAnalyzed: pages.length,
        opportunitiesDetected: opportunities.length,
        healthScore: health.total,
        internalLinksSuggested: linkSuggestions.length,
      },
      state: "COMPLETED",
      startedAt,
      finishedAt,
    },
  });

  const run = await prisma.automationRun.create({
    data: {
      ruleId: rule.id,
      websiteId: website.id,
      startedAt,
      finishedAt,
      status: "completed",
      summary: {
        queriesAnalyzed: queries.length,
        pagesAnalyzed: pages.length,
        opportunitiesDetected: opportunities.length,
        healthScore: health.total,
        internalLinksSuggested: linkSuggestions.length,
      },
      taskIds: [task.id],
    },
  });

  await prisma.automationRule.update({
    where: { id: rule.id },
    data: { lastRunAt: finishedAt },
  });

  await prisma.agentLog.create({
    data: {
      websiteId: website.id,
      taskId: task.id,
      agent: "orchestrator",
      level: "info",
      message: `Executed "${rule.name}": ${opportunities.length} opportunities, health score ${health.total}/100, ${linkSuggestions.length} internal links.`,
    },
  });

  return NextResponse.json({
    data: {
      run,
      summary: {
        queriesAnalyzed: queries.length,
        pagesAnalyzed: pages.length,
        opportunitiesDetected: opportunities.length,
        healthScore: health.total,
        internalLinksSuggested: linkSuggestions.length,
      },
    },
  });
}
