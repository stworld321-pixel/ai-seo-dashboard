import { NextResponse } from "next/server";
import { purgeWebsiteFromLocalStore } from "@/server/local-store";
import { runFullSiteAiAudit } from "@/server/services/ai-site-auditor";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { message: "Unauthorized: Please sign in to remove websites." } }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: { message: "Website ID is required" } }, { status: 400 });
  }

  // 1. Try finding website in Prisma
  let website = await prisma.website.findUnique({ where: { id } });
  if (!website) {
    website = await prisma.website.findFirst({
      where: { OR: [{ id }, { url: id }, { url: `${id}/` }] },
    });
  }

  // 2. Permission check:
  if (!user.isAdmin) {
    const memberships = await prisma.orgMember.findMany({ where: { userId: user.id } });
    const userOrgIds = memberships.map((m) => m.orgId).filter(Boolean);
    if (user.orgId && !userOrgIds.includes(user.orgId)) {
      userOrgIds.push(user.orgId);
    }

    if (website && !userOrgIds.includes(website.orgId)) {
      return NextResponse.json(
        { error: { message: "Forbidden: You do not have permission to delete this website." } },
        { status: 403 },
      );
    }
  }

  const orgId = website?.orgId || user.orgId || "";

  // 3. Delete from PostgreSQL. schema.prisma declares onDelete: Cascade, but the
  //    live database has no matching foreign keys, so deleting the parent alone
  //    silently leaves every child row behind (verified: one site orphaned 325
  //    rows across 12 tables). Remove children explicitly, in one transaction.
  try {
    await prisma.$transaction([
      prisma.gscDaily.deleteMany({ where: { websiteId: id } }),
      prisma.gscQueryDaily.deleteMany({ where: { websiteId: id } }),
      prisma.gscPageDaily.deleteMany({ where: { websiteId: id } }),
      prisma.gscQueryPageDaily.deleteMany({ where: { websiteId: id } }),
      prisma.gscDimensionDaily.deleteMany({ where: { websiteId: id } }),
      prisma.syncCursor.deleteMany({ where: { websiteId: id } }),
      prisma.keyword.deleteMany({ where: { websiteId: id } }),
      prisma.opportunity.deleteMany({ where: { websiteId: id } }),
      prisma.approval.deleteMany({ where: { websiteId: id } }),
      prisma.integration.deleteMany({ where: { websiteId: id } }),
      prisma.googleConnection.deleteMany({ where: { websiteId: id } }),
      prisma.publishingConnection.deleteMany({ where: { websiteId: id } }),
      // Content references PageRecord, so it must go first.
      prisma.content.deleteMany({ where: { websiteId: id } }),
      prisma.pageRecord.deleteMany({ where: { websiteId: id } }),
      prisma.website.deleteMany({ where: { id } }),
    ]);
  } catch (err) {
    console.error(`[websites] Failed to delete website ${id}:`, err);
    return NextResponse.json(
      { error: { message: "Could not delete the website. No data was removed." } },
      { status: 500 },
    );
  }

  // 4. Also purge from local resilient store
  const result = purgeWebsiteFromLocalStore(id, orgId);

  // 5. Find next remaining website for this user
  let nextId: string | null = null;
  if (orgId) {
    const nextSite = await prisma.website.findFirst({
      where: { orgId, id: { not: id } },
      orderBy: { createdAt: "desc" },
    });
    nextId = nextSite?.id || result.nextWebsiteId || null;
  }

  const response = NextResponse.json({
    data: {
      deletedId: id,
      deletedName: website?.name || result.deletedName || "Website",
      nextWebsiteId: nextId,
    },
  });

  if (nextId) {
    response.cookies.set("active_website_id", nextId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    response.cookies.set("active_website_id", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
  }

  return response;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: { message: "Website ID is required" } }, { status: 400 });
  }

  try {
    const auditResult = await runFullSiteAiAudit(id);
    const response = NextResponse.json({ data: auditResult });
    response.cookies.set("active_website_id", id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "AI Audit failed" } },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: { message: "Website ID is required" } }, { status: 400 });
  }

  const json = (await request.json().catch(() => ({}))) as {
    name?: string;
    cms?: "WORDPRESS" | "SHOPIFY" | "WEBFLOW" | "NEXTJS" | "REACT" | "LARAVEL" | "CUSTOM" | "OTHER";
    wpUsername?: string;
    wpAppPassword?: string;
    loginUrl?: string;
  };

  const { prisma } = await import("@/server/db");
  const website = await prisma.website.findUnique({ where: { id } });
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const updated = await prisma.website.update({
    where: { id },
    data: {
      ...(json.name ? { name: json.name.trim() } : {}),
      ...(json.cms ? { cms: json.cms } : {}),
    },
  });

  const wpUser = json.wpUsername?.trim();
  const wpPass = json.wpAppPassword?.trim();
  if (wpUser && wpPass) {
    const { encryptJson } = await import("@/server/crypto");
    const encrypted = encryptJson({
      username: wpUser,
      appPassword: wpPass,
    });
    const bareUrl = website.url.replace(/\/+$/, "");

    await prisma.integration.upsert({
      where: {
        websiteId_kind_provider: {
          websiteId: id,
          kind: "CMS",
          provider: "wordpress",
        },
      },
      create: {
        websiteId: id,
        kind: "CMS",
        provider: "wordpress",
        externalId: bareUrl,
        config: {
          siteUrl: bareUrl,
          seoPlugin: "rank_math",
          primaryPostType: "product",
          loginUrl: json.loginUrl?.trim() || `${bareUrl}/wp-login.php`,
        },
        status: "ACTIVE",
        lastSyncAt: new Date(),
        secretCipher: new Uint8Array(encrypted.cipher),
        secretIv: new Uint8Array(encrypted.iv),
        secretTag: new Uint8Array(encrypted.tag),
      },
      update: {
        status: "ACTIVE",
        lastSyncAt: new Date(),
        config: {
          siteUrl: bareUrl,
          seoPlugin: "rank_math",
          primaryPostType: "product",
          loginUrl: json.loginUrl?.trim() || `${bareUrl}/wp-login.php`,
        },
        secretCipher: new Uint8Array(encrypted.cipher),
        secretIv: new Uint8Array(encrypted.iv),
        secretTag: new Uint8Array(encrypted.tag),
      },
    });

    const { syncLiveWordPressCatalogAndTelemetry } = await import("@/server/services/wordpress-sync");
    void syncLiveWordPressCatalogAndTelemetry({
      websiteId: website.id,
      siteUrl: website.url,
    }).catch(() => {});
  }

  return NextResponse.json({ data: updated });
}
