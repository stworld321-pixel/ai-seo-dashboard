import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import {
  saveGoogleConnection,
  fetchGoogleSearchConsoleProperties,
  fetchGoogleAnalytics4Properties,
  GOOGLE_SCOPES,
} from "@/server/integrations/google/oauth";
import { syncDirectGoogleSearchConsole } from "@/server/integrations/google/gsc";
import { syncDirectGoogleAnalytics4 } from "@/server/integrations/google/ga4";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    accessToken?: string;
    refreshToken?: string;
    gscProperty?: string;
    ga4PropertyId?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const accessToken = body.accessToken?.trim();
  if (!accessToken) {
    return NextResponse.json(
      {
        error: {
          message:
            "A valid Google OAuth session or Access Token is required to connect Gmail. Please sign in with Google OAuth.",
        },
      },
      { status: 400 },
    );
  }

  // Verify the token against live Google APIs (userinfo + Search Console sites)
  let email: string | undefined;
  try {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userRes.ok) {
      const userJson = (await userRes.json()) as { email?: string };
      email = userJson.email;
    }
  } catch {
    // ignore
  }

  let gscProps: Array<{ siteUrl: string; permissionLevel: string; isDomain: boolean }> = [];
  try {
    gscProps = await fetchGoogleSearchConsoleProperties(accessToken);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          message:
            err instanceof Error
              ? `Google Search Console verification failed: ${err.message}`
              : "Invalid or expired Google OAuth Access Token.",
        },
      },
      { status: 401 },
    );
  }

  const ga4Props = await fetchGoogleAnalytics4Properties(accessToken).catch(() => []);

  const googleConn = await saveGoogleConnection(website.id, {
    accessToken,
    refreshToken: body.refreshToken?.trim() || undefined,
    expiresIn: 3600,
    scopes: GOOGLE_SCOPES,
    email,
  });

  const targetDomain = new URL(website.url).hostname.replace(/^www\./, "").toLowerCase();
  const matchedGsc =
    body.gscProperty?.trim() ||
    gscProps.find((p) => p.siteUrl.toLowerCase().includes(targetDomain))?.siteUrl ||
    gscProps[0]?.siteUrl ||
    website.url;

  const matchedGa4 =
    body.ga4PropertyId?.trim() ||
    ga4Props.find((g) => g.propertyName.toLowerCase().includes(targetDomain))?.propertyId ||
    ga4Props[0]?.propertyId ||
    null;

  await prisma.gscProperty.updateMany({
    where: { websiteId: website.id },
    data: { isSelected: false },
  });

  await prisma.gscProperty.upsert({
    where: {
      websiteId_propertyUrl: {
        websiteId: website.id,
        propertyUrl: matchedGsc,
      },
    },
    create: {
      websiteId: website.id,
      googleConnectionId: googleConn.id,
      propertyUrl: matchedGsc,
      propertyType: matchedGsc.startsWith("sc-domain:") ? "DOMAIN" : "URL_PREFIX",
      permissionLevel: "siteOwner",
      isSelected: true,
    },
    update: {
      googleConnectionId: googleConn.id,
      isSelected: true,
    },
  });

  await prisma.integration.upsert({
    where: {
      websiteId_kind_provider: {
        websiteId: website.id,
        kind: "GSC",
        provider: "google_search_console",
      },
    },
    create: {
      websiteId: website.id,
      kind: "GSC",
      provider: "google_search_console",
      externalId: matchedGsc,
      status: "ACTIVE",
      lastSyncAt: new Date(),
    },
    update: {
      externalId: matchedGsc,
      status: "ACTIVE",
      lastSyncAt: new Date(),
    },
  });

  if (matchedGa4) {
    await prisma.ga4Property.updateMany({
      where: { websiteId: website.id },
      data: { isSelected: false },
    });

    await prisma.ga4Property.upsert({
      where: {
        websiteId_propertyId: {
          websiteId: website.id,
          propertyId: matchedGa4,
        },
      },
      create: {
        websiteId: website.id,
        googleConnectionId: googleConn.id,
        propertyId: matchedGa4,
        propertyName: website.name,
        isSelected: true,
      },
      update: {
        googleConnectionId: googleConn.id,
        isSelected: true,
      },
    });

    await prisma.integration.upsert({
      where: {
        websiteId_kind_provider: {
          websiteId: website.id,
          kind: "GA4",
          provider: "google_analytics",
        },
      },
      create: {
        websiteId: website.id,
        kind: "GA4",
        provider: "google_analytics",
        externalId: matchedGa4,
        status: "ACTIVE",
        lastSyncAt: new Date(),
      },
      update: {
        externalId: matchedGa4,
        status: "ACTIVE",
        lastSyncAt: new Date(),
      },
    });
  }

  const updatedWebsite = await prisma.website.update({
    where: { id: website.id },
    data: {
      gscProperty: matchedGsc,
      ga4PropertyId: matchedGa4,
      lastGscSyncAt: new Date(),
      ...(matchedGa4 ? { lastGa4SyncAt: new Date() } : {}),
    },
  });

  // Sync real Search Console & GA4 rows from Google API
  const [gscSync] = await Promise.all([
    syncDirectGoogleSearchConsole(website.id, 28).catch(() => null),
    matchedGa4 ? syncDirectGoogleAnalytics4(website.id, 28).catch(() => null) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    data: {
      website: updatedWebsite,
      email,
      gscProperty: matchedGsc,
      ga4PropertyId: matchedGa4,
      rowsSynced: gscSync?.rowsProcessed ?? 0,
      connected: true,
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);

  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  await prisma.googleConnection.deleteMany({ where: { websiteId: website.id } });
  await prisma.gscProperty.deleteMany({ where: { websiteId: website.id } });
  await prisma.ga4Property.deleteMany({ where: { websiteId: website.id } });
  await prisma.integration.deleteMany({
    where: { websiteId: website.id, kind: { in: ["GSC", "GA4"] } },
  });

  await prisma.website.update({
    where: { id: website.id },
    data: {
      gscProperty: null,
      ga4PropertyId: null,
    },
  });

  return NextResponse.json({ data: { disconnected: true } });
}
