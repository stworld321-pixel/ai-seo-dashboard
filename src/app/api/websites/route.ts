import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { encryptJson } from "@/server/crypto";
import { syncLiveWordPressCatalogAndTelemetry } from "@/server/services/wordpress-sync";

const createWebsiteSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  cms: z
    .enum([
      "WORDPRESS",
      "SHOPIFY",
      "WEBFLOW",
      "NEXTJS",
      "REACT",
      "LARAVEL",
      "CUSTOM",
      "OTHER",
    ])
    .default("WORDPRESS"),
  gscProperty: z.string().max(255).optional().nullable(),
  ga4PropertyId: z.string().max(120).optional().nullable(),
  country: z.string().min(2).max(10).default("IND"),
  timezone: z.string().min(2).max(64).default("Asia/Kolkata"),
  automationLevel: z.number().int().min(1).max(5).default(2),
  wpUsername: z.string().max(160).optional(),
  wpAppPassword: z.string().max(160).optional(),
});

import { getCurrentUser } from "@/server/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const showAll = searchParams.get("all") === "true";

  if (user.isAdmin && showAll) {
    const websites = await prisma.website.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: websites });
  }

  const memberships = await prisma.orgMember.findMany({ where: { userId: user.id } });
  const orgIds = memberships.map((m) => m.orgId).filter(Boolean);
  if (orgIds.length === 0 && user.orgId) orgIds.push(user.orgId);

  const websites = await prisma.website.findMany({
    where: { orgId: { in: orgIds } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: websites });
}

export async function POST(request: Request) {
  // Previously an unauthenticated POST silently provisioned a throwaway account
  // ("user-xxxx@workspace.local") and handed back a session for it. A SaaS must
  // not create real tenants from an anonymous request — fail closed instead.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to add a website." } },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createWebsiteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid website payload",
        },
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  let targetOrgId = user.orgId;
  if (!targetOrgId) {
    const membership = await prisma.orgMember.findFirst({ where: { userId: user.id } });
    targetOrgId = membership?.orgId || null;
  }
  if (!targetOrgId) {
    const newOrg = await prisma.organization.create({
      data: {
        name: `${user.name || "My"} Workspace`,
        slug: `org-${user.id.slice(-6)}-${Math.random().toString(36).slice(2, 6)}`,
      },
    });
    await prisma.orgMember.create({
      data: { orgId: newOrg.id, userId: user.id, role: "OWNER" },
    });
    targetOrgId = newOrg.id;
  }

  const normalizedUrl = input.url.endsWith("/") ? input.url : `${input.url}/`;
  const bareUrl = normalizedUrl.replace(/\/+$/, "");
  const allSites = await prisma.website.findMany({ where: { orgId: targetOrgId } });
  const existingSite = allSites.find(
    (s) => s.url === normalizedUrl || s.url.replace(/\/+$/, "") === bareUrl,
  );

  // Check website limits based on active plan
  if (!existingSite && !user.isAdmin) {
    const { checkWebsiteLimit } = await import("@/server/services/credits");
    const limitCheck = await checkWebsiteLimit(user.id);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "PLAN_LIMIT_EXCEEDED",
            message: limitCheck.error || "Website plan limit reached. Please upgrade your plan.",
          },
        },
        { status: 403 },
      );
    }
  }

  const defaultGsc = input.gscProperty?.trim() || existingSite?.gscProperty || null;
  const defaultGa4 = input.ga4PropertyId?.trim() || existingSite?.ga4PropertyId || null;

  let website;
  try {
    website = existingSite
      ? await prisma.website.update({
          where: { id: existingSite.id },
          data: {
            cms: input.cms,
            ...(defaultGsc ? { gscProperty: defaultGsc } : {}),
            ...(defaultGa4 ? { ga4PropertyId: defaultGa4 } : {}),
          },
        })
      : await prisma.website.create({
          data: {
            orgId: targetOrgId,
            name: input.name.trim(),
            url: normalizedUrl,
            cms: input.cms,
            gscProperty: defaultGsc,
            ga4PropertyId: defaultGa4,
            sitemapUrl: `${normalizedUrl}sitemap_index.xml`,
            robotsUrl: `${normalizedUrl}robots.txt`,
            country: input.country.trim().toUpperCase(),
            timezone: input.timezone.trim(),
            automationLevel: input.automationLevel,
          },
        });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "DB_ERROR",
          message: err instanceof Error ? err.message : "Failed to create website in database.",
        },
      },
      { status: 500 },
    );
  }

  if (input.cms === "WORDPRESS") {
    const wpUser = input.wpUsername?.trim();
    const wpPass = input.wpAppPassword?.trim();
    const hasCreds = Boolean(wpUser && wpPass);
    const encrypted = hasCreds
      ? encryptJson({
          username: wpUser!,
          appPassword: wpPass!,
        })
      : null;

    const existingIntegration = await prisma.integration.findFirst({
      where: {
        websiteId: website.id,
        kind: "CMS",
        provider: "wordpress",
      },
    });

    await prisma.integration.upsert({
      where: {
        websiteId_kind_provider: {
          websiteId: website.id,
          kind: "CMS",
          provider: "wordpress",
        },
      },
      create: {
        websiteId: website.id,
        kind: "CMS",
        provider: "wordpress",
        externalId: bareUrl,
        config: {
          siteUrl: bareUrl,
          seoPlugin: "rank_math",
          primaryPostType: "product",
        },
        status: hasCreds ? "ACTIVE" : "PENDING",
        lastSyncAt: new Date(),
        ...(encrypted
          ? {
              secretCipher: new Uint8Array(encrypted.cipher),
              secretIv: new Uint8Array(encrypted.iv),
              secretTag: new Uint8Array(encrypted.tag),
            }
          : {}),
      },
      update: {
        status: hasCreds || existingIntegration?.status === "ACTIVE" ? "ACTIVE" : "PENDING",
        lastSyncAt: new Date(),
        ...(encrypted
          ? {
              secretCipher: new Uint8Array(encrypted.cipher),
              secretIv: new Uint8Array(encrypted.iv),
              secretTag: new Uint8Array(encrypted.tag),
            }
          : {}),
      },
    });

    // Run catalog sync asynchronously so onboarding/analyze responds immediately
    void syncLiveWordPressCatalogAndTelemetry({
      websiteId: website.id,
      siteUrl: normalizedUrl,
    }).catch(() => {});
  }

  // Auto-discover and link Google Search Console / GA4 if a Google account is connected
  void (async () => {
    try {
      const { getValidGoogleAccessToken, fetchGoogleSearchConsoleProperties, fetchGoogleAnalytics4Properties } =
        await import("@/server/integrations/google/oauth");
      const { syncDirectGoogleSearchConsole } = await import("@/server/integrations/google/gsc");
      const { syncDirectGoogleAnalytics4 } = await import("@/server/integrations/google/ga4");

      const token = await getValidGoogleAccessToken(website.id);
      if (token) {
        const domain = new URL(normalizedUrl).hostname.replace(/^www\./, "").toLowerCase();
        const [gscProps, ga4Props] = await Promise.all([
          fetchGoogleSearchConsoleProperties(token).catch(() => []),
          fetchGoogleAnalytics4Properties(token).catch(() => []),
        ]);

        const matchedGsc = gscProps.find((p) => p.siteUrl.toLowerCase().includes(domain));
        const matchedGa4 = ga4Props.find((g) => g.propertyName?.toLowerCase().includes(domain));

        if (matchedGsc) {
          await prisma.website.update({
            where: { id: website.id },
            data: { gscProperty: matchedGsc.siteUrl },
          });
          await prisma.gscProperty.upsert({
            where: { websiteId_propertyUrl: { websiteId: website.id, propertyUrl: matchedGsc.siteUrl } },
            create: {
              websiteId: website.id,
              googleConnectionId: "auto-discovered",
              propertyUrl: matchedGsc.siteUrl,
              propertyType: matchedGsc.isDomain ? "DOMAIN" : "URL_PREFIX",
              permissionLevel: matchedGsc.permissionLevel,
              isSelected: true,
            },
            update: { isSelected: true },
          });
          await syncDirectGoogleSearchConsole(website.id, 28).catch(() => {});
        }

        if (matchedGa4) {
          await prisma.website.update({
            where: { id: website.id },
            data: { ga4PropertyId: matchedGa4.propertyId },
          });
          await prisma.ga4Property.upsert({
            where: { websiteId_propertyId: { websiteId: website.id, propertyId: matchedGa4.propertyId } },
            create: {
              websiteId: website.id,
              googleConnectionId: "auto-discovered",
              accountId: matchedGa4.accountId,
              propertyId: matchedGa4.propertyId,
              propertyName: matchedGa4.propertyName,
              isSelected: true,
            },
            update: { isSelected: true },
          });
          await syncDirectGoogleAnalytics4(website.id, 28).catch(() => {});
        }
      }
    } catch {
      // Background auto-linking failure is non-fatal
    }
  })();

  // Always trigger autonomous public crawl + AI SEO & Agent audit so any site works even without GSC/WP credentials
  void import("@/server/services/ai-site-auditor")
    .then(({ runFullSiteAiAudit }) => runFullSiteAiAudit(website.id))
    .catch(() => {});

  const response = NextResponse.json({ data: website });
  response.cookies.set("active_website_id", website.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
