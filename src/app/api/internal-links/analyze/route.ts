import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  getDefaultWebsite,
  getOpportunities,
  getPageMetrics,
  getQueryMetrics,
  resolveWindow,
} from "@/server/services/dashboard";
import { generateInternalLinkSuggestions } from "@/server/intelligence/internal-links";
import { applyInternalLinkToLiveWordPress } from "@/server/services/wordpress-sync";
import type { Opportunity } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    suggestionId?: string;
    status?: "approved" | "dismissed" | "applied" | "suggested";
    action?: "sync_all_approved";
  };

  if (body.action === "sync_all_approved") {
    const website = await getDefaultWebsite(body.websiteId);
    if (!website) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "No website connected" } },
        { status: 404 },
      );
    }

    const allSuggestions = await prisma.internalLinkSuggestion.findMany({
      where: { websiteId: website.id },
    });
    const toSync = allSuggestions.filter(
      (s) => s.status === "approved" || s.status === "applied",
    );

    const results: Array<{
      id: string;
      sourceUrl: string;
      targetUrl: string;
      anchor: string;
      ok: boolean;
      cmsId?: string;
      mode?: string;
      error?: string;
    }> = [];

    for (const s of toSync) {
      try {
        const res = await applyInternalLinkToLiveWordPress({
          websiteId: website.id,
          sourceUrl: s.sourceUrl,
          targetUrl: s.targetUrl,
          anchor: s.anchor,
        });
        await prisma.internalLinkSuggestion.update({
          where: { id: s.id },
          data: {
            status: "applied",
            appliedAt: new Date(),
          },
        });
        results.push({
          id: s.id,
          sourceUrl: s.sourceUrl,
          targetUrl: s.targetUrl,
          anchor: s.anchor,
          ok: true,
          cmsId: res.cmsId,
          mode: res.mode,
        });
      } catch (err) {
        results.push({
          id: s.id,
          sourceUrl: s.sourceUrl,
          targetUrl: s.targetUrl,
          anchor: s.anchor,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    await prisma.agentLog.create({
      data: {
        websiteId: website.id,
        agent: "internal-linker",
        level: "info",
        message: `Synced ${okCount}/${toSync.length} approved internal links to live WordPress site (${website.url}).`,
      },
    });

    return NextResponse.json({
      data: {
        synced: okCount,
        total: toSync.length,
        results,
      },
    });
  }

  if (body.suggestionId && body.status) {
    const existing = await prisma.internalLinkSuggestion.findUnique({
      where: { id: body.suggestionId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Internal link suggestion not found" } },
        { status: 404 },
      );
    }

    let liveSync: {
      ok: boolean;
      cmsId?: string;
      postType?: string;
      mode?: string;
      changed?: boolean;
      error?: string;
    } | null = null;

    if (body.status === "approved" || body.status === "applied") {
      try {
        const wpRes = await applyInternalLinkToLiveWordPress({
          websiteId: existing.websiteId,
          sourceUrl: existing.sourceUrl,
          targetUrl: existing.targetUrl,
          anchor: existing.anchor,
        });
        liveSync = {
          ok: true,
          cmsId: wpRes.cmsId,
          postType: wpRes.postType,
          mode: wpRes.mode,
          changed: wpRes.changed,
        };

        await prisma.agentLog.create({
          data: {
            websiteId: existing.websiteId,
            agent: "internal-linker",
            level: "info",
            message: `Published internal link [${existing.anchor}] (${existing.sourceUrl} → ${existing.targetUrl}) on live WordPress ${wpRes.postType} #${wpRes.cmsId} (${wpRes.mode}).`,
          },
        });
      } catch (err) {
        liveSync = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const finalStatus =
      (body.status === "approved" || body.status === "applied") && liveSync?.ok
        ? "applied"
        : body.status;

    const updated = await prisma.internalLinkSuggestion.update({
      where: { id: body.suggestionId },
      data: {
        status: finalStatus,
        ...(body.status === "applied" || body.status === "approved"
          ? { appliedAt: new Date() }
          : {}),
      },
    });

    return NextResponse.json({ data: updated, liveSync });
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website connected" } },
      { status: 404 },
    );
  }

  let w = await resolveWindow(website.id, "28d");
  let pageRecords = await prisma.pageRecord.findMany({ where: { websiteId: website.id } });

  if (pageRecords.length < 2) {
    const { ensureWebsiteAudited } = await import("@/server/services/ai-site-auditor");
    await ensureWebsiteAudited(website.id);
    pageRecords = await prisma.pageRecord.findMany({ where: { websiteId: website.id } });
    if (!w) {
      w = await resolveWindow(website.id, "28d");
    }
  }

  const [pages, queries, opps] = await Promise.all([
    w ? getPageMetrics(website.id, w) : Promise.resolve([]),
    w ? getQueryMetrics(website.id, w) : Promise.resolve([]),
    getOpportunities(website.id),
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

  const suggestions = generateInternalLinkSuggestions({
    pages,
    queries,
    opportunities: mappedOpps,
    pageRecords,
  });

  for (const s of suggestions) {
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

  const stored = await prisma.internalLinkSuggestion.findMany({
    where: { websiteId: website.id },
    orderBy: { confidence: "desc" },
  });

  return NextResponse.json({ data: stored });
}
