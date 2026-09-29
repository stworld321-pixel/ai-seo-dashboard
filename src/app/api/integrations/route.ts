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
