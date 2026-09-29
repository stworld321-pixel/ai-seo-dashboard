import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite, getPageMetrics, getQueryMetrics, resolveWindow } from "@/server/services/dashboard";
import { scoreContent, buildArticleAndFaqSchema, markdownToWordPressHtml } from "@/server/intelligence/content-scorer";
import { generateWithConfiguredAi } from "@/server/integrations/llm/provider";
import { generateInternalLinkSuggestions } from "@/server/intelligence/internal-links";
import type { Opportunity as DomainOpportunity } from "@/lib/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "optimize_meta" | "generate_draft" | "suggest_links" | "refresh_content" | "dismiss" | "mark_done";
    customTitle?: string;
    customMeta?: string;
    customKeyword?: string;
    secondaryKeywords?: string[];
    publishLive?: boolean;
    provider?: string;
    model?: string;
  };

  let opp = await prisma.opportunity.findUnique({
    where: { id },
    include: { website: true },
  });

  if (!opp) {
    const website = await getDefaultWebsite();
    if (!website) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "No active website connected" } },
        { status: 404 },
      );
    }
    const targetKw = (body.customKeyword || id || "organic growth")
      .replace(/^opp-/, "")
      .trim();

    const existingByKw = await prisma.opportunity.findFirst({
      where: { websiteId: website.id, keyword: { equals: targetKw, mode: "insensitive" } },
      include: { website: true },
    });

    if (existingByKw) {
      opp = existingByKw;
    } else {
      opp = await prisma.opportunity.create({
        data: {
          websiteId: website.id,
          type: "CONTENT_GAP",
          keyword: targetKw,
          priority: 1,
          score: 90,
          why: `Generated content draft for "${targetKw}".`,
          evidence: {},
          recommendation: [{ action: "Generate AI Article Draft" }],
        },
        include: { website: true },
      });
    }
  }

  const website = opp.website;
  const targetKeyword = (body.customKeyword || opp.keyword || "organic skincare").trim();
  const targetUrl = opp.targetUrl?.trim() || null;

  // 1. Direct Dismiss
  if (body.action === "dismiss") {
    const updated = await prisma.opportunity.update({
      where: { id },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    await prisma.agentLog.create({
      data: {
        websiteId: website.id,
        agent: "opportunity-manager",
        level: "info",
        message: `Dismissed opportunity [${opp.type}] for keyword "${targetKeyword}".`,
      },
    });
    return NextResponse.json({ data: { success: true, status: "DISMISSED", opportunity: updated } });
  }

  // 2. Direct Mark Done
  if (body.action === "mark_done") {
    const updated = await prisma.opportunity.update({
      where: { id },
      data: { status: "DONE", resolvedAt: new Date() },
    });
    await prisma.agentLog.create({
      data: {
        websiteId: website.id,
        agent: "opportunity-manager",
        level: "info",
        message: `Marked opportunity [${opp.type}] for keyword "${targetKeyword}" as completed.`,
      },
    });
    return NextResponse.json({ data: { success: true, status: "DONE", opportunity: updated } });
  }

  // Determine requested action type if not explicitly supplied
  const effectiveAction =
    body.action ||
    (opp.type === "QUICK_WIN" || opp.type === "CTR_GAP"
      ? "optimize_meta"
      : opp.type === "INTERNAL_LINK"
        ? "suggest_links"
        : "generate_draft");

  // ACTION A: Meta Optimization & Schema Enhancement (Quick Win / CTR Gap)
  if (effectiveAction === "optimize_meta") {
    const pageRecord = targetUrl
      ? await prisma.pageRecord.findUnique({
          where: { websiteId_url: { websiteId: website.id, url: targetUrl } },
        })
      : null;

    const existingTitle = body.customTitle || pageRecord?.title || "";
    const existingMeta = body.customMeta || pageRecord?.metaDescription || "";

    const report = scoreContent({
      keyword: targetKeyword,
      title: existingTitle,
      metaDescription: existingMeta,
      body: "",
    });

    const optimizedTitle = body.customTitle?.trim() || report.suggestedTitle;
    const optimizedMeta = body.customMeta?.trim() || report.suggestedMeta;

    // Create or update Content entity in DB
    const content = await prisma.content.create({
      data: {
        websiteId: website.id,
        pageId: pageRecord?.id ?? null,
        type: "META_TITLE",
        title: optimizedTitle,
        primaryKeyword: targetKeyword,
        status: "AWAITING_APPROVAL",
        qaReport: report,
        authorAgent: "onpage-optimizer",
        publishedUrl: targetUrl,
      },
    });

    // Create ContentVersion
    await prisma.contentVersion.create({
      data: {
        contentId: content.id,
        version: 1,
        body: `Optimized title: ${optimizedTitle}\nOptimized meta: ${optimizedMeta}`,
        diffSummary: `Optimized SEO metadata for ${targetKeyword} (${targetUrl ?? "sitewide"})`,
        createdBy: "onpage-optimizer",
      },
    });

    // Queue in Approval gate
    const approval = await prisma.approval.create({
      data: {
        websiteId: website.id,
        entityType: "content",
        entityId: content.id,
        action: "update_seo_meta",
        riskLevel: "LOW",
        payload: {
          title: optimizedTitle,
          metaDescription: optimizedMeta,
          keyword: targetKeyword,
          targetUrl,
        },
        diff: {
          before: {
            seoTitle: pageRecord?.title ?? null,
            metaDescription: pageRecord?.metaDescription ?? null,
          },
          after: {
            seoTitle: optimizedTitle,
            metaDescription: optimizedMeta,
          },
        },
        status: "pending",
        requestedBy: "onpage-optimizer",
      },
    });

    // Update Opportunity status to IN_PROGRESS
    const updatedOpp = await prisma.opportunity.update({
      where: { id },
      data: { status: "IN_PROGRESS" },
    });

    await prisma.agentLog.create({
      data: {
        websiteId: website.id,
        agent: "onpage-optimizer",
        level: "info",
        message: `Generated optimized SEO title & meta description for "${targetKeyword}" (${targetUrl ?? "general"}). Approval #${approval.id} created.`,
      },
    });

    return NextResponse.json({
      data: {
        success: true,
        action: "optimize_meta",
        opportunity: updatedOpp,
        content,
        approvalId: approval.id,
        optimizedTitle,
        optimizedMeta,
        qaReport: report,
      },
    });
  }

  // ACTION B: Full SEO + AEO + GEO Article & Content Generation (Page Two / Content Gap / Content Decay)
  if (effectiveAction === "generate_draft" || effectiveAction === "refresh_content") {
    const ev = (opp.evidence ?? {}) as Record<string, number>;
    const impressions = Number(ev.impressions ?? 0);
    const position = Number(ev.position ?? 0);

    const draft = await generateWithConfiguredAi({
      websiteId: website.id,
      providerOverride: body.provider,
      modelOverride: body.model,
      keyword: targetKeyword,
      customTitle: body.customTitle,
      secondaryKeywords: body.secondaryKeywords ?? [],
      targetUrl,
      impressions,
      position,
    });

    const cleanSlug =
      draft.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const htmlPreview = markdownToWordPressHtml(draft.body, draft.schemaJsonLd);

    const targetPage = targetUrl
      ? await prisma.pageRecord.findUnique({
          where: { websiteId_url: { websiteId: website.id, url: targetUrl } },
        })
      : null;

    let publishedLive: {
      ok: boolean;
      id?: string;
      url?: string;
      slug?: string;
      error?: string;
    } | null = null;

    if (body.publishLive && draft.qaReport.qaPassed) {
      try {
        const { publishBlogPostToLiveWordPress } = await import("@/server/services/wordpress-sync");
        const wpPost = await publishBlogPostToLiveWordPress({
          websiteId: website.id,
          title: draft.title,
          slug: cleanSlug,
          htmlContent: htmlPreview,
          excerpt: draft.metaDescription,
          seoTitle: draft.title,
          metaDescription: draft.metaDescription,
          focusKeyword: targetKeyword,
          status: "publish",
        });
        publishedLive = {
          ok: true,
          id: wpPost.id,
          url: wpPost.url,
          slug: wpPost.slug,
        };
      } catch (err) {
        publishedLive = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const contentStatus = publishedLive?.ok
      ? "PUBLISHED"
      : draft.qaReport.qaPassed
        ? "AWAITING_APPROVAL"
        : "QA_FAILED";

    const created = await prisma.content.create({
      data: {
        websiteId: website.id,
        pageId: targetPage?.id ?? null,
        type: "ARTICLE",
        title: draft.title,
        slug: cleanSlug,
        primaryKeyword: targetKeyword,
        secondaryKeywords: draft.secondaryKeywords,
        intent: draft.intent,
        brief: draft.brief,
        body: draft.body,
        faq: draft.faq,
        status: contentStatus,
        qaReport: draft.qaReport,
        authorAgent: draft.authorAgent,
        publishedUrl: publishedLive?.url ?? targetUrl,
        ...(publishedLive?.ok ? { publishedAt: new Date() } : {}),
      },
    });

    await prisma.contentVersion.create({
      data: {
        contentId: created.id,
        version: 1,
        body: draft.body,
        diffSummary: `Generated SEO+AEO+GEO Article "${draft.title}" for "${targetKeyword}" using ${draft.modelUsed}`,
        createdBy: draft.authorAgent,
      },
    });

    let approvalId: string | null = null;
    if (draft.qaReport.qaPassed && !publishedLive?.ok) {
      const approval = await prisma.approval.create({
        data: {
          websiteId: website.id,
          entityType: "content",
          entityId: created.id,
          action: "publish_content",
          riskLevel: "LOW",
          payload: {
            title: draft.title,
            slug: cleanSlug,
            metaDescription: draft.metaDescription,
            keyword: targetKeyword,
            targetUrl,
            modelUsed: draft.modelUsed,
          },
          diff: {
            before: {
              seoTitle: targetPage?.title ?? null,
              metaDescription: targetPage?.metaDescription ?? null,
            },
            after: {
              seoTitle: draft.title,
              metaDescription: draft.metaDescription,
            },
          },
          status: "pending",
          requestedBy: draft.authorAgent,
        },
      });
      approvalId = approval.id;
    }

    const updatedOpp = await prisma.opportunity.update({
      where: { id },
      data: {
        status: publishedLive?.ok ? "DONE" : "IN_PROGRESS",
        ...(publishedLive?.ok ? { resolvedAt: new Date() } : {}),
      },
    });

    await prisma.agentLog.create({
      data: {
        websiteId: website.id,
        agent: "content-writer",
        level: "info",
        message: `Implemented opportunity [${opp.type}] by generating 1,500+ word article "${draft.title}" for "${targetKeyword}". Approval #${approvalId ?? "direct"}.`,
      },
    });

    return NextResponse.json({
      data: {
        success: true,
        action: "generate_draft",
        opportunity: updatedOpp,
        content: created,
        draft,
        htmlPreview,
        approvalId,
        publishedLive,
      },
    });
  }

  // ACTION C: Internal Link Suggestions & Graph Wiring
  if (effectiveAction === "suggest_links") {
    const w = await resolveWindow(website.id, "28d");
    const [pages, queries] = w
      ? await Promise.all([getPageMetrics(website.id, w), getQueryMetrics(website.id, w)])
      : [[], []];

    const mappedOpp: DomainOpportunity = {
      type: opp.type,
      keyword: opp.keyword ?? undefined,
      targetUrl: opp.targetUrl ?? undefined,
      score: opp.score,
      priority: opp.priority,
      estimatedClicks: opp.estimatedClicks,
      why: opp.why,
      evidence: opp.evidence as Record<string, string | number | null>,
      recommendation: opp.recommendation as { action: string; detail?: string }[],
    };

    const suggestions = generateInternalLinkSuggestions({
      pages,
      queries,
      opportunities: [mappedOpp],
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

    const updatedOpp = await prisma.opportunity.update({
      where: { id },
      data: { status: "IN_PROGRESS" },
    });

    await prisma.agentLog.create({
      data: {
        websiteId: website.id,
        agent: "internal-linker",
        level: "info",
        message: `Generated ${suggestions.length} internal link suggestions for opportunity "${targetKeyword}".`,
      },
    });

    return NextResponse.json({
      data: {
        success: true,
        action: "suggest_links",
        opportunity: updatedOpp,
        suggestions,
      },
    });
  }

  return NextResponse.json(
    { error: { code: "UNSUPPORTED_ACTION", message: `Action "${effectiveAction}" is not supported.` } },
    { status: 400 },
  );
}
