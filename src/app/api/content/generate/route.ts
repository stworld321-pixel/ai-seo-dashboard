import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  getDefaultWebsite,
  getQueryMetrics,
  resolveWindow,
} from "@/server/services/dashboard";
import { generateWithConfiguredAi } from "@/server/integrations/llm/provider";
import {
  buildArticleAndFaqSchema,
  markdownToWordPressHtml,
} from "@/server/intelligence/content-scorer";
import { publishBlogPostToLiveWordPress } from "@/server/services/wordpress-sync";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    keyword?: string;
    customTitle?: string;
    customSlug?: string;
    secondaryKeywords?: string[];
    opportunityId?: string;
    type?: "ARTICLE" | "META_TITLE" | "FAQ";
    provider?: string;
    model?: string;
    publishLive?: boolean;
    contentId?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website connected" } },
      { status: 404 },
    );
  }

  // Action: publish an existing generated draft directly to live WordPress
  if (body.contentId && body.publishLive) {
    const existing = await prisma.content.findUnique({ where: { id: body.contentId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Content draft not found" } },
        { status: 404 },
      );
    }

    const faqList = Array.isArray(existing.faq)
      ? (existing.faq as { question: string; answer: string }[])
      : [];
    const schemaJsonLd = buildArticleAndFaqSchema({
      title: existing.title,
      description: `Complete SEO, AEO & GEO guide on ${existing.primaryKeyword ?? existing.title} by ${website.name}.`,
      keyword: existing.primaryKeyword ?? existing.title,
      url: `${website.url.replace(/\/+$/, "")}/${existing.slug}/`,
      faq: faqList,
    });
    const htmlContent = markdownToWordPressHtml(existing.body ?? "", schemaJsonLd);

    try {
      const wpPost = await publishBlogPostToLiveWordPress({
        websiteId: website.id,
        title: existing.title,
        slug: existing.slug ?? undefined,
        htmlContent,
        seoTitle: existing.title,
        metaDescription: `Looking for ${existing.primaryKeyword ?? existing.title}? Explore key insights, expert recommendations, and FAQs by ${website.name}.`.slice(
          0,
          158,
        ),
        focusKeyword: existing.primaryKeyword ?? undefined,
        status: "publish",
      });

      const updated = await prisma.content.update({
        where: { id: existing.id },
        data: {
          status: "PUBLISHED",
          publishedUrl: wpPost.url,
          publishedAt: new Date(),
        },
      });

      await prisma.agentLog.create({
        data: {
          websiteId: website.id,
          agent: "content-writer",
          level: "info",
          message: `Published SEO+AEO+GEO blog post "${existing.title}" live to WordPress (#${wpPost.id} → ${wpPost.url}).`,
        },
      });

      return NextResponse.json({
        data: {
          content: updated,
          publishedLive: {
            ok: true,
            id: wpPost.id,
            url: wpPost.url,
            slug: wpPost.slug,
          },
        },
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: {
            code: "WP_PUBLISH_FAILED",
            message: err instanceof Error ? err.message : String(err),
          },
        },
        { status: 500 },
      );
    }
  }

  let keyword = body.keyword?.trim() ?? "";
  let targetUrl: string | null = null;
  let impressions = 0;
  let position = 0;

  if (body.opportunityId) {
    const opp = await prisma.opportunity.findUnique({ where: { id: body.opportunityId } });
    if (opp) {
      keyword = keyword || opp.keyword || "natural skin care";
      targetUrl = opp.targetUrl;
      const ev = (opp.evidence ?? {}) as Record<string, number>;
      impressions = Number(ev.impressions ?? 0);
      position = Number(ev.position ?? 0);
    }
  }

  if (!keyword) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Keyword is required" } },
      { status: 400 },
    );
  }

  const w = await resolveWindow(website.id, "28d");
  const queries = w ? await getQueryMetrics(website.id, w) : [];
  const matchQuery = queries.find((q) => q.query.toLowerCase() === keyword.toLowerCase());
  if (matchQuery) {
    impressions = impressions || matchQuery.impressions;
    position = position || matchQuery.position;
    targetUrl = targetUrl ?? matchQuery.page ?? null;
  }

  const autoSecondary = queries
    .filter(
      (q) =>
        q.query.toLowerCase() !== keyword.toLowerCase() &&
        q.query
          .toLowerCase()
          .split(/\s+/)
          .some((t) => t.length >= 4 && keyword.toLowerCase().includes(t)),
    )
    .map((q) => q.query)
    .slice(0, 5);

  const customSecondary = Array.isArray(body.secondaryKeywords)
    ? body.secondaryKeywords.map((s) => s.trim()).filter(Boolean)
    : [];
  const secondaryKeywords =
    customSecondary.length > 0 ? customSecondary : autoSecondary;

  const draft = await generateWithConfiguredAi({
    websiteId: website.id,
    providerOverride: body.provider,
    modelOverride: body.model,
    keyword,
    customTitle: body.customTitle,
    secondaryKeywords,
    targetUrl,
    impressions,
    position,
  });

  const cleanSlug =
    body.customSlug?.trim() ||
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
      const wpPost = await publishBlogPostToLiveWordPress({
        websiteId: website.id,
        title: draft.title,
        slug: cleanSlug,
        htmlContent: htmlPreview,
        excerpt: draft.metaDescription,
        seoTitle: draft.title,
        metaDescription: draft.metaDescription,
        focusKeyword: keyword,
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
      type: body.type ?? "ARTICLE",
      title: draft.title,
      slug: cleanSlug,
      primaryKeyword: keyword,
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
      diffSummary: `Generated SEO+AEO+GEO ${body.type ?? "ARTICLE"} "${draft.title}" for "${keyword}" using ${draft.modelUsed} (Score ${draft.qaReport.score}/100 · SEO ${draft.qaReport.seoScore}% · AEO ${draft.qaReport.aeoScore}% · GEO ${draft.qaReport.geoScore}%)`,
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
          keyword,
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

  return NextResponse.json({
    data: {
      content: created,
      metaDescription: draft.metaDescription,
      qaReport: draft.qaReport,
      schemaJsonLd: draft.schemaJsonLd,
      htmlPreview,
      approvalId,
      modelUsed: draft.modelUsed,
      publishedLive,
    },
  });
}
