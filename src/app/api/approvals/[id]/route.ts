import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { markdownToWordPressHtml, buildArticleAndFaqSchema } from "@/server/intelligence/content-scorer";
import { canAccessWebsite } from "@/server/auth";

/** Same 404 whether the record is missing or belongs to another tenant. */
const notFound = () =>
  NextResponse.json({ error: { code: "NOT_FOUND", message: "Approval item not found" } }, { status: 404 });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const approval = await prisma.approval.findUnique({
    where: { id },
    include: { website: true },
  });

  if (!approval) return notFound();
  if (!(await canAccessWebsite(approval.websiteId))) return notFound();

  let content = null;
  let htmlPreview = "";

  if (approval.entityType === "content") {
    content = await prisma.content.findUnique({
      where: { id: approval.entityId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (content?.body) {
      const faqList = Array.isArray(content.faq)
        ? (content.faq as { question: string; answer: string }[])
        : [];
      const schema = buildArticleAndFaqSchema({
        title: content.title,
        description: `Complete guide on ${content.primaryKeyword ?? content.title} by ${approval.website.name}.`,
        keyword: content.primaryKeyword ?? content.title,
        url: `${approval.website.url.replace(/\/+$/, "")}/${content.slug ?? ""}/`,
        faq: faqList,
        websiteName: approval.website.name,
        websiteUrl: approval.website.url,
      });
      htmlPreview = markdownToWordPressHtml(content.body, schema);
    }
  }

  return NextResponse.json({
    data: {
      approval,
      content,
      htmlPreview,
      website: {
        id: approval.website.id,
        name: approval.website.name,
        url: approval.website.url,
      },
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    decision?: "approved" | "rejected";
    note?: string;
    publishLive?: boolean;
  };

  if (body.decision !== "approved" && body.decision !== "rejected") {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Decision must be 'approved' or 'rejected'" } },
      { status: 400 },
    );
  }

  const approval = await prisma.approval.findUnique({
    where: { id },
    include: { website: true },
  });
  if (!approval) return notFound();
  if (!(await canAccessWebsite(approval.websiteId))) return notFound();

  const now = new Date();
  let wpSyncMessage = "";
  const website = approval.website;
  const siteUrl = (website?.url ?? "https://example.com").replace(/\/+$/, "");
  const brandName = website?.name?.trim() || "Brand";

  if (body.decision === "approved" && approval.action === "update_seo_meta") {
    const payload = (approval.payload ?? {}) as {
      title?: string;
      metaDescription?: string;
      keyword?: string;
      targetUrl?: string | null;
    };
    if (payload.targetUrl && process.env.WP_USERNAME && process.env.WP_APP_PASSWORD) {
      try {
        const { WordPressProvider } = await import("@/server/integrations/cms/wordpress");
        const wp = new WordPressProvider({
          siteUrl,
          username: process.env.WP_USERNAME,
          appPassword: process.env.WP_APP_PASSWORD,
        });
        const item = await wp.getByUrl(payload.targetUrl);
        if (item) {
          await wp.updateSeoMeta(item.id, {
            seoTitle: payload.title,
            metaDescription: payload.metaDescription,
            focusKeyword: payload.keyword,
          });
          wpSyncMessage = ` Live WordPress SEO meta updated on ${payload.targetUrl} (CMS ID ${item.id}).`;
        }
      } catch (err) {
        wpSyncMessage = ` (WordPress push skipped: ${err instanceof Error ? err.message : String(err)})`;
      }
    }
  }

  const updated = await prisma.approval.update({
    where: { id },
    data: {
      status: body.decision,
      decidedAt: now,
      note: body.note ?? null,
    },
  });

  if (approval.entityType === "content") {
    const existingContent = await prisma.content.findUnique({ where: { id: approval.entityId } });
    let publishedUrl: string | undefined;

    if (body.decision === "approved" && body.publishLive && existingContent) {
      try {
        const { publishBlogPostToLiveWordPress } = await import("@/server/services/wordpress-sync");
        const faqList = Array.isArray(existingContent.faq)
          ? (existingContent.faq as { question: string; answer: string }[])
          : [];
        const schemaJsonLd = buildArticleAndFaqSchema({
          title: existingContent.title,
          description: `Complete guide on ${existingContent.primaryKeyword ?? existingContent.title} by ${brandName}.`,
          keyword: existingContent.primaryKeyword ?? existingContent.title,
          url: `${siteUrl}/${existingContent.slug ?? ""}/`,
          faq: faqList,
          websiteName: brandName,
          websiteUrl: siteUrl,
        });
        const htmlContent = markdownToWordPressHtml(existingContent.body ?? "", schemaJsonLd);
        const wpPost = await publishBlogPostToLiveWordPress({
          websiteId: approval.websiteId,
          title: existingContent.title,
          slug: existingContent.slug ?? undefined,
          htmlContent,
          seoTitle: existingContent.title,
          focusKeyword: existingContent.primaryKeyword ?? undefined,
          status: "publish",
        });
        publishedUrl = wpPost.url;
        wpSyncMessage = ` Published live on WordPress (#${wpPost.id} → ${wpPost.url}).`;
      } catch (err) {
        wpSyncMessage = ` (WordPress publish skipped: ${err instanceof Error ? err.message : String(err)})`;
      }
    }

    await prisma.content
      .update({
        where: { id: approval.entityId },
        data: {
          status:
            body.decision === "approved"
              ? publishedUrl
                ? "PUBLISHED"
                : "APPROVED"
              : "REJECTED",
          ...(publishedUrl ? { publishedUrl, publishedAt: now } : {}),
        },
      })
      .catch(() => null);
  }

  await prisma.agentLog.create({
    data: {
      websiteId: approval.websiteId,
      agent: "approval-gate",
      level: "info",
      message: `Human ${body.decision} ${approval.action} on ${approval.entityType}:${approval.entityId}${body.note ? ` — "${body.note}"` : ""}.${wpSyncMessage}`,
    },
  });

  return NextResponse.json({ data: updated, wpSyncMessage });
}
