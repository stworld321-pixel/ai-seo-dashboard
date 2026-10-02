import { prisma } from "@/server/db";
import { decryptJson, encryptJson } from "@/server/crypto";
import {
  WordPressProvider,
  type LiveSiteTelemetry,
} from "@/server/integrations/cms/wordpress";

function countWordsFromHtml(html?: string): number | null {
  if (!html) return null;
  const plain = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  return plain.split(" ").length;
}

export async function syncLiveWordPressCatalogAndTelemetry(params: {
  websiteId: string;
  siteUrl: string;
}): Promise<{
  syncedPages: number;
  telemetry: LiveSiteTelemetry;
}> {
  const cleanSiteUrl = params.siteUrl.replace(/\/+$/, "");

  // Resolve credentials from .env or stored encrypted integration
  let username = process.env.WP_USERNAME?.trim() || undefined;
  let appPassword = process.env.WP_APP_PASSWORD?.trim() || undefined;

  if (!username || !appPassword) {
    const existingCms = await prisma.integration.findUnique({
      where: {
        websiteId_kind_provider: {
          websiteId: params.websiteId,
          kind: "CMS",
          provider: "wordpress",
        },
      },
    });
    if (
      existingCms?.secretCipher &&
      existingCms?.secretIv &&
      existingCms?.secretTag
    ) {
      try {
        const creds = decryptJson<{ username?: string; appPassword?: string }>({
          cipher: Buffer.from(existingCms.secretCipher),
          iv: Buffer.from(existingCms.secretIv),
          tag: Buffer.from(existingCms.secretTag),
        });
        username = creds.username || username;
        appPassword = creds.appPassword || appPassword;
      } catch {
        // Ignore decryption failure
      }
    }
  }

  const wp = new WordPressProvider({
    siteUrl: cleanSiteUrl,
    username,
    appPassword,
    timeoutMs: 25_000,
  });

  const telemetry = await wp.fetchLiveSiteTelemetry();
  const now = new Date();

  // Map Rank Math per-URL link & score metrics
  const rmByUrl = new Map<
    string,
    {
      isOrphan: boolean;
      seoScore: number;
      internalLinks: number;
      externalLinks: number;
      incomingLinks: number;
    }
  >();
  for (const p of telemetry.rankMathLinks?.posts ?? []) {
    const norm = p.url.replace(/\/+$/, "");
    rmByUrl.set(norm, {
      isOrphan: p.isOrphan,
      seoScore: p.seoScore,
      internalLinks: p.internalLinks,
      externalLinks: p.externalLinks,
      incomingLinks: p.incomingLinks,
    });
  }

  let syncedPages = 0;
  for (const postType of ["product", "pages", "posts"]) {
    try {
      const items = await wp.listContent({ type: postType, limit: 100 });
      for (const item of items) {
        if (!item.url) continue;
        const normUrl = item.url.replace(/\/+$/, "");
        const rm = rmByUrl.get(normUrl);
        const wordCount = countWordsFromHtml(item.content);
        const detail = {
          cmsId: item.id,
          postType: item.type,
          focusKeyword: item.focusKeyword ?? null,
          internalLinks: rm?.internalLinks ?? 0,
          externalLinks: rm?.externalLinks ?? 0,
          incomingLinks: rm?.incomingLinks ?? 0,
        };

        await prisma.pageRecord.upsert({
          where: {
            websiteId_url: {
              websiteId: params.websiteId,
              url: item.url,
            },
          },
          create: {
            websiteId: params.websiteId,
            url: item.url,
            title: item.seoTitle ?? item.title,
            h1: item.title,
            metaDescription: item.metaDescription,
            wordCount,
            indexState: "PASS",
            canonical: item.url,
            isOrphan: rm?.isOrphan ?? false,
            contentScore: rm?.seoScore && rm.seoScore > 0 ? rm.seoScore : null,
            contentScoreDetail: detail,
            lastCrawledAt: now,
            lastModifiedAt: new Date(item.modifiedAt),
            status: !item.metaDescription ? "OPTIMIZE" : "HEALTHY",
          },
          update: {
            title: item.seoTitle ?? item.title,
            h1: item.title,
            metaDescription: item.metaDescription,
            ...(wordCount !== null ? { wordCount } : {}),
            isOrphan: rm?.isOrphan ?? false,
            ...(rm?.seoScore && rm.seoScore > 0 ? { contentScore: rm.seoScore } : {}),
            contentScoreDetail: detail,
            lastCrawledAt: now,
            lastModifiedAt: new Date(item.modifiedAt),
            status: !item.metaDescription ? "OPTIMIZE" : "HEALTHY",
          },
        });
        syncedPages += 1;
      }
    } catch {
      // Ignore unsupported post type
    }
  }

  const hasSecret = Boolean(username && appPassword);
  let secret: ReturnType<typeof encryptJson> | null = null;
  if (hasSecret) {
    try {
      secret = encryptJson({ username, appPassword });
    } catch {
      secret = null;
    }
  }

  await prisma.integration.upsert({
    where: {
      websiteId_kind_provider: {
        websiteId: params.websiteId,
        kind: "CMS",
        provider: "wordpress",
      },
    },
    create: {
      websiteId: params.websiteId,
      kind: "CMS",
      provider: "wordpress",
      externalId: cleanSiteUrl,
      config: {
        siteUrl: cleanSiteUrl,
        seoPlugin: "rank_math",
        primaryPostType: "product",
        woocommerce: telemetry.woocommerce,
        rankMathLinks: telemetry.rankMathLinks,
      },
      status: hasSecret ? "ACTIVE" : "PENDING",
      lastSyncAt: now,
      ...(secret
        ? {
            secretCipher: new Uint8Array(secret.cipher),
            secretIv: new Uint8Array(secret.iv),
            secretTag: new Uint8Array(secret.tag),
          }
        : {}),
    },
    update: {
      externalId: cleanSiteUrl,
      config: {
        siteUrl: cleanSiteUrl,
        seoPlugin: "rank_math",
        primaryPostType: "product",
        woocommerce: telemetry.woocommerce,
        rankMathLinks: telemetry.rankMathLinks,
      },
      status: hasSecret ? "ACTIVE" : "PENDING",
      lastSyncAt: now,
      ...(secret
        ? {
            secretCipher: new Uint8Array(secret.cipher),
            secretIv: new Uint8Array(secret.iv),
            secretTag: new Uint8Array(secret.tag),
          }
        : {}),
    },
  });

  if (telemetry.ga4?.propertyId) {
    await prisma.website.update({
      where: { id: params.websiteId },
      data: { ga4PropertyId: telemetry.ga4.propertyId },
    });

    await prisma.integration.upsert({
      where: {
        websiteId_kind_provider: {
          websiteId: params.websiteId,
          kind: "GA4",
          provider: "google-site-kit",
        },
      },
      create: {
        websiteId: params.websiteId,
        kind: "GA4",
        provider: "google-site-kit",
        externalId: telemetry.ga4.propertyId,
        config: telemetry.ga4,
        status: "ACTIVE",
        lastSyncAt: now,
      },
      update: {
        externalId: telemetry.ga4.propertyId,
        config: telemetry.ga4,
        status: "ACTIVE",
        lastSyncAt: now,
      },
    });
  }

  return { syncedPages, telemetry };
}

export async function getLiveSiteTelemetryFromDb(
  websiteId: string,
): Promise<LiveSiteTelemetry> {
  const [cmsIntegration, ga4Integration] = await Promise.all([
    prisma.integration.findFirst({
      where: { websiteId, kind: "CMS" },
    }),
    prisma.integration.findFirst({
      where: { websiteId, kind: "GA4" },
    }),
  ]);

  const cmsConfig = (cmsIntegration?.config ?? {}) as {
    woocommerce?: LiveSiteTelemetry["woocommerce"];
    rankMathLinks?: LiveSiteTelemetry["rankMathLinks"];
  };
  const ga4Config = (ga4Integration?.config ?? null) as LiveSiteTelemetry["ga4"];

  return {
    ga4: ga4Config?.propertyId ? ga4Config : null,
    woocommerce: cmsConfig.woocommerce ?? null,
    rankMathLinks: cmsConfig.rankMathLinks ?? null,
  };
}

export async function applyInternalLinkToLiveWordPress(params: {
  websiteId: string;
  sourceUrl: string;
  targetUrl: string;
  anchor: string;
}): Promise<{
  cmsId: string;
  postType: string;
  sourceUrl: string;
  targetUrl: string;
  anchor: string;
  changed: boolean;
  mode: "already-linked" | "inline-anchor" | "contextual-callout";
}> {
  const website = await prisma.website.findUnique({ where: { id: params.websiteId } });
  const cleanSiteUrl = (website?.url || process.env.WP_URL || "").replace(
    /\/+$/,
    "",
  );

  let username = process.env.WP_USERNAME?.trim() || undefined;
  let appPassword = process.env.WP_APP_PASSWORD?.trim() || undefined;

  const existingCms = await prisma.integration.findFirst({
    where: { websiteId: params.websiteId, kind: "CMS" },
  });

  if ((!username || !appPassword) && existingCms?.secretCipher && existingCms?.secretIv && existingCms?.secretTag) {
    try {
      const creds = decryptJson<{ username?: string; appPassword?: string }>({
        cipher: Buffer.from(existingCms.secretCipher),
        iv: Buffer.from(existingCms.secretIv),
        tag: Buffer.from(existingCms.secretTag),
      });
      username = creds.username || username;
      appPassword = creds.appPassword || appPassword;
    } catch {
      // Ignore decryption failure
    }
  }

  const wp = new WordPressProvider({
    siteUrl: cleanSiteUrl,
    username,
    appPassword,
    timeoutMs: 25_000,
  });

  const result = await wp.applyInternalLink({
    sourceUrl: params.sourceUrl,
    targetUrl: params.targetUrl,
    anchor: params.anchor,
  });

  // Refresh Rank Math link telemetry in background/DB so the Internal Links page updates immediately
  try {
    const telemetry = await wp.fetchLiveSiteTelemetry();
    if (existingCms && telemetry.rankMathLinks) {
      const prevConfig = (existingCms.config ?? {}) as Record<string, unknown>;
      await prisma.integration.update({
        where: { id: existingCms.id },
        data: {
          config: {
            ...prevConfig,
            ...(telemetry.woocommerce ? { woocommerce: telemetry.woocommerce } : {}),
            rankMathLinks: telemetry.rankMathLinks,
          },
          lastSyncAt: new Date(),
        },
      });
    }
  } catch {
    // Non-fatal if telemetry refresh fails
  }

  return result;
}

/**
 * Builds an authenticated WordPress client for a website, resolving credentials
 * from the environment first and then the encrypted CMS integration record.
 * Shared by publishing and category management so both see the same site.
 */
export async function getWordPressProvider(websiteId: string): Promise<WordPressProvider> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  const cleanSiteUrl = (website?.url || process.env.WP_URL || "").replace(
    /\/+$/,
    "",
  );

  let username = process.env.WP_USERNAME?.trim() || undefined;
  let appPassword = process.env.WP_APP_PASSWORD?.trim() || undefined;

  const existingCms = await prisma.integration.findFirst({
    where: { websiteId, kind: "CMS" },
  });

  if (
    (!username || !appPassword) &&
    existingCms?.secretCipher &&
    existingCms?.secretIv &&
    existingCms?.secretTag
  ) {
    try {
      const creds = decryptJson<{ username?: string; appPassword?: string }>({
        cipher: Buffer.from(existingCms.secretCipher),
        iv: Buffer.from(existingCms.secretIv),
        tag: Buffer.from(existingCms.secretTag),
      });
      username = creds.username || username;
      appPassword = creds.appPassword || appPassword;
    } catch {
      // Ignore decryption failure
    }
  }

  return new WordPressProvider({
    siteUrl: cleanSiteUrl,
    username,
    appPassword,
    timeoutMs: 25_000,
  });
}

export async function publishBlogPostToLiveWordPress(params: {
  websiteId: string;
  title: string;
  slug?: string;
  htmlContent: string;
  excerpt?: string;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  status?: "publish" | "draft";
  categories?: number[];
  scheduledAt?: Date;
}): Promise<{ id: string; url: string; slug: string; status: string; scheduledAt?: string }> {
  const wp = await getWordPressProvider(params.websiteId);

  return wp.publishBlogPost({
    title: params.title,
    slug: params.slug,
    htmlContent: params.htmlContent,
    excerpt: params.excerpt,
    seoTitle: params.seoTitle,
    metaDescription: params.metaDescription,
    focusKeyword: params.focusKeyword,
    status: params.status ?? "publish",
    categories: params.categories,
    scheduledAt: params.scheduledAt,
  });
}

export async function listWordPressCategories(websiteId: string) {
  return (await getWordPressProvider(websiteId)).listCategories();
}

export async function createWordPressCategory(websiteId: string, name: string) {
  return (await getWordPressProvider(websiteId)).createCategory(name);
}


