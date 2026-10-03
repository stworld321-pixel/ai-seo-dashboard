import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { WordPressProvider } from "@/server/integrations/cms/wordpress";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    pageUrl?: string;
    seoTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
  };

  if (!body.websiteId || !body.pageUrl) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "websiteId and pageUrl are required" } },
      { status: 400 },
    );
  }

  const website = await prisma.website.findUnique({
    where: { id: body.websiteId },
    include: {
      integrations: {
        where: { kind: "CMS", provider: "wordpress" },
      },
    },
  });

  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Website not found" } },
      { status: 404 },
    );
  }

  const wpIntegration = website.integrations?.[0];
  const config = (wpIntegration?.config ?? {}) as Record<string, string>;
  const username = config.username || process.env.WP_USERNAME;
  const appPassword = config.appPassword || process.env.WP_APP_PASSWORD;

  if (!username || !appPassword) {
    // If live WordPress credentials aren't configured yet, update PageRecord locally and return graceful response
    const updatedPage = await prisma.pageRecord.updateMany({
      where: {
        websiteId: website.id,
        url: { in: [body.pageUrl, body.pageUrl.replace(/\/+$/, ""), `${body.pageUrl.replace(/\/+$/, "")}/`] },
      },
      data: {
        title: body.seoTitle || undefined,
        metaDescription: body.metaDescription || undefined,
      },
    });

    return NextResponse.json({
      data: {
        syncedToWp: false,
        message: "Updated in SEO Command Center catalog. (Connect WordPress Application Password in Integrations to sync to live WordPress site).",
        updatedCount: updatedPage.count,
      },
    });
  }

  try {
    const wp = new WordPressProvider({
      siteUrl: website.url,
      username,
      appPassword,
    });

    const item = await wp.getByUrl(body.pageUrl);
    if (!item) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `WordPress post/page/product not found for ${body.pageUrl}` } },
        { status: 404 },
      );
    }

    await wp.updateSeoMeta(item.id, {
      seoTitle: body.seoTitle,
      metaDescription: body.metaDescription,
      focusKeyword: body.focusKeyword,
    });

    // Also update our database PageRecord
    await prisma.pageRecord.updateMany({
      where: {
        websiteId: website.id,
        url: { in: [body.pageUrl, body.pageUrl.replace(/\/+$/, ""), `${body.pageUrl.replace(/\/+$/, "")}/`] },
      },
      data: {
        title: body.seoTitle || undefined,
        metaDescription: body.metaDescription || undefined,
      },
    });

    return NextResponse.json({
      data: {
        syncedToWp: true,
        cmsId: item.id,
        postType: item.type,
        message: `Successfully pushed updated SEO metadata to live WordPress ${item.type} #${item.id}!`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "WP_SYNC_FAILED", message: err.message || "Failed to push to WordPress" } },
      { status: 500 },
    );
  }
}
