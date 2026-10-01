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
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: { message: "Website ID is required" } }, { status: 400 });
  }

  const website = await prisma.website.findUnique({ where: { id } });
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  if (!user.isAdmin) {
    const memberships = await prisma.orgMember.findMany({ where: { userId: user.id } });
    const userOrgIds = memberships.map((m) => m.orgId);
    if (!userOrgIds.includes(website.orgId)) {
      return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
    }
  }

  // 1. Delete from PostgreSQL database (with Prisma cascade on child records)
  try {
    await prisma.website.delete({ where: { id } }).catch(() => {});
  } catch {
    // ignore
  }

  // 2. Also purge from local resilient store
  const result = purgeWebsiteFromLocalStore(id, website.orgId);

  // Find next website in the organization
  const nextSite = await prisma.website.findFirst({
    where: { orgId: website.orgId, id: { not: id } },
    orderBy: { createdAt: "desc" },
  });

  const nextId = nextSite?.id || result.nextWebsiteId || null;

  const response = NextResponse.json({
    data: {
      deletedId: id,
      deletedName: website.name || result.deletedName,
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
    response.cookies.delete("active_website_id");
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
