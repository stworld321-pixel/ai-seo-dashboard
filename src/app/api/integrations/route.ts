import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { encryptJson } from "@/server/crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);

  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const [integrations, googleConn, gscProps, ga4Props] = await Promise.all([
    prisma.integration.findMany({
      where: { websiteId: website.id },
      select: {
        id: true,
        kind: true,
        provider: true,
        externalId: true,
        status: true,
        config: true,
        lastSyncAt: true,
        createdAt: true,
      },
    }),
    prisma.googleConnection.findFirst({
      where: { websiteId: website.id, status: "connected" },
    }),
    prisma.gscProperty.findMany({ where: { websiteId: website.id } }),
    prisma.ga4Property.findMany({ where: { websiteId: website.id } }),
  ]);

  const selectedGsc = gscProps.find((p) => p.isSelected);
  const selectedGa4 = ga4Props.find((p) => p.isSelected);

  const gscIntegration = integrations.find((i) => i.kind === "GSC" && i.status === "ACTIVE");
  const ga4Integration = integrations.find((i) => i.kind === "GA4" && i.status === "ACTIVE");

  const isGscConnected =
    Boolean(gscIntegration) ||
    Boolean(selectedGsc && selectedGsc.googleConnectionId !== "composio-gsc") ||
    Boolean(googleConn && website.gscProperty);

  const isGa4Connected =
    Boolean(ga4Integration) ||
    Boolean(selectedGa4) ||
    Boolean(website.ga4PropertyId);

  return NextResponse.json({
    data: {
      website: {
        id: website.id,
        name: website.name,
        url: website.url,
        cms: website.cms,
      },
      integrations,
      google: {
        isConnected: Boolean(googleConn || isGscConnected),
        email: googleConn?.email ?? null,
        isGscConnected,
        gscProperty: selectedGsc?.propertyUrl ?? website.gscProperty ?? (isGscConnected ? website.url : null),
        isGa4Connected,
        ga4PropertyId: selectedGa4?.propertyId ?? website.ga4PropertyId ?? null,
      },
    },
  });
}

export async function POST(request: Request) {
  const json = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    provider: string;
    kind: "CMS" | "GSC" | "GA4" | "LLM";
    config?: Record<string, unknown>;
    secrets?: Record<string, string>;
    externalId?: string;
  };

  const website = await getDefaultWebsite(json.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  if (!json.provider) {
    return NextResponse.json({ error: { message: "Provider is required" } }, { status: 400 });
  }

  const kind = json.kind || "CMS";
  const config = (json.config ?? {}) as Record<string, unknown>;

  // Sanitize siteUrl if present
  if (config.siteUrl && typeof config.siteUrl === "string") {
    let clean = config.siteUrl.trim();
    const doubleMatch = clean.match(/https?:\/\/[^\/]+\/(https?:\/\/.*)/i);
    if (doubleMatch?.[1]) {
      clean = doubleMatch[1];
    }
    config.siteUrl = clean.replace(/\/+$/, "");
  }

  // Live verification for WordPress CMS credentials before saving
  if (kind === "CMS" && (json.provider === "wordpress_self_hosted" || json.provider === "wordpress")) {
    const wpUsername = ((json.secrets?.username || config.username) as string | undefined)?.trim();
    const wpPassword = ((json.secrets?.appPassword || config.appPassword) as string | undefined)?.trim();
    const wpUrl = (config.siteUrl || json.secrets?.siteUrl || website.url) as string;

    if (wpUsername && wpPassword) {
      const { WordPressProvider } = await import("@/server/integrations/cms/wordpress");
      const testClient = new WordPressProvider({
        siteUrl: wpUrl,
        username: wpUsername,
        appPassword: wpPassword,
        timeoutMs: 12000,
      });

      try {
        await testClient.listCategories();
      } catch (testErr) {
        const msg = testErr instanceof Error ? testErr.message : String(testErr);
        if (msg.includes("401") || msg.includes("incorrect_password")) {
          return NextResponse.json(
            {
              error: {
                message:
                  "WordPress rejected the application password (401 Incorrect Password). Please verify the username and generate a fresh Application Password in WP Admin → Users → Profile.",
              },
            },
            { status: 401 },
          );
        }
      }
    }

    // Clean up conflicting opposite provider record so there's only one active WordPress CMS
    const otherProvider = json.provider === "wordpress_self_hosted" ? "wordpress" : "wordpress_self_hosted";
    await prisma.integration.deleteMany({
      where: { websiteId: website.id, kind: "CMS", provider: otherProvider },
    }).catch(() => {});
  }

  let encryptedData: import("@/server/crypto").Encrypted | null = null;

  if (json.secrets && Object.keys(json.secrets).length > 0) {
    try {
      encryptedData = encryptJson(json.secrets);
    } catch {
      // ignore encryption failure if crypto not ready
    }
  }

  const integration = await prisma.integration.upsert({
    where: {
      websiteId_kind_provider: {
        websiteId: website.id,
        kind,
        provider: json.provider,
      },
    },
    create: {
      websiteId: website.id,
      kind,
      provider: json.provider,
      externalId: json.externalId || (typeof config.siteUrl === "string" ? config.siteUrl : website.url),
      config: config as Prisma.InputJsonValue,
      status: "ACTIVE",
      lastSyncAt: new Date(),
      ...(encryptedData
        ? {
            secretCipher: encryptedData.cipher,
            secretIv: encryptedData.iv,
            secretTag: encryptedData.tag,
          }
        : {}),
    },
    update: {
      status: "ACTIVE",
      config: config as Prisma.InputJsonValue,
      externalId: json.externalId || (typeof config.siteUrl === "string" ? config.siteUrl : undefined),
      lastSyncAt: new Date(),
      ...(encryptedData
        ? {
            secretCipher: encryptedData.cipher,
            secretIv: encryptedData.iv,
            secretTag: encryptedData.tag,
          }
        : {}),
    },
  });

  return NextResponse.json({
    data: {
      id: integration.id,
      provider: integration.provider,
      kind: integration.kind,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ error: { message: "Provider is required" } }, { status: 400 });
  }

  const website = await getDefaultWebsite(websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  await prisma.integration.deleteMany({
    where: {
      websiteId: website.id,
      provider,
    },
  });

  return NextResponse.json({ data: { disconnected: true, provider } });
}
