import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { scoreContent } from "@/server/intelligence/content-scorer";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    keyword?: string;
    url?: string;
    title?: string;
    metaDescription?: string;
    contentBody?: string;
    queueApproval?: boolean;
  };

  const keyword = (body.keyword ?? "").trim();
  if (!keyword) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Target keyword is required" } },
      { status: 400 },
    );
  }

  const report = scoreContent({
    keyword,
    title: body.title ?? "",
    metaDescription: body.metaDescription ?? "",
    body: body.contentBody ?? "",
  });

  let approvalId: string | null = null;
  if (body.queueApproval) {
    const website = await getDefaultWebsite(body.websiteId);
    if (website) {
      const targetUrl = body.url?.trim() || null;
      const page = targetUrl
        ? await prisma.pageRecord.findUnique({
            where: { websiteId_url: { websiteId: website.id, url: targetUrl } },
          })
        : null;

      const content = await prisma.content.create({
        data: {
          websiteId: website.id,
          pageId: page?.id ?? null,
          type: "META_TITLE",
          title: body.title || report.suggestedTitle,
          primaryKeyword: keyword,
          body: body.contentBody || "",
          status: report.qaPassed ? "AWAITING_APPROVAL" : "QA_FAILED",
          qaReport: report,
          authorAgent: "onpage-optimizer",
          publishedUrl: targetUrl,
        },
      });

      const approval = await prisma.approval.create({
        data: {
          websiteId: website.id,
          entityType: "content",
          entityId: content.id,
          action: "update_seo_meta",
          riskLevel: "LOW",
          payload: {
            keyword,
            targetUrl,
            seoTitle: body.title || report.suggestedTitle,
            metaDescription: body.metaDescription || report.suggestedMeta,
          },
          diff: {
            before: {
              seoTitle: page?.title ?? null,
              metaDescription: page?.metaDescription ?? null,
            },
            after: {
              seoTitle: body.title || report.suggestedTitle,
              metaDescription: body.metaDescription || report.suggestedMeta,
            },
          },
          status: "pending",
          requestedBy: "onpage-optimizer",
        },
      });
      approvalId = approval.id;
    }
  }

  return NextResponse.json({
    data: {
      report,
      approvalId,
    },
  });
}
