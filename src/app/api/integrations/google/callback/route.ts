import { NextResponse } from "next/server";
import {
  exchangeGoogleAuthCode,
  saveGoogleConnection,
  fetchGoogleSearchConsoleProperties,
  fetchGoogleAnalytics4Properties,
} from "@/server/integrations/google/oauth";
import { syncDirectGoogleSearchConsole } from "@/server/integrations/google/gsc";
import { syncDirectGoogleAnalytics4 } from "@/server/integrations/google/ga4";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/integrations/google?error=${encodeURIComponent(error || "Access Denied")}`, request.url),
    );
  }

  let websiteId: string | undefined;
  try {
    if (stateRaw) {
      const stateObj = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) as { websiteId?: string };
      websiteId = stateObj.websiteId;
    }
  } catch {
    // ignore
  }

  if (!websiteId) {
    const defaultSite = await prisma.website.findFirst();
    websiteId = defaultSite?.id;
  }

  if (!websiteId) {
    return NextResponse.redirect(new URL("/integrations/google?error=No+Website+Found", request.url));
  }

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/integrations/google/callback`;

  try {
    const tokens = await exchangeGoogleAuthCode(code, redirectUri);
    const googleConn = await saveGoogleConnection(websiteId, tokens);

    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    const targetDomain = website ? new URL(website.url).hostname.replace(/^www\./, "").toLowerCase() : "";

    let chosenGscProperty: string | null = null;
    let chosenGa4PropertyId: string | null = null;

    // Discover real GSC & GA4 properties from the authenticated Gmail account
    try {
      const [gscProps, ga4Props] = await Promise.all([
        fetchGoogleSearchConsoleProperties(tokens.accessToken).catch(() => []),
        fetchGoogleAnalytics4Properties(tokens.accessToken).catch(() => []),
      ]);

      for (const p of gscProps) {
        const isMatched = targetDomain ? p.siteUrl.toLowerCase().includes(targetDomain) : false;
        if (isMatched && !chosenGscProperty) chosenGscProperty = p.siteUrl;
        await prisma.gscProperty.upsert({
          where: { websiteId_propertyUrl: { websiteId, propertyUrl: p.siteUrl } },
          create: {
            websiteId,
            googleConnectionId: googleConn.id,
            propertyUrl: p.siteUrl,
            propertyType: p.isDomain ? "DOMAIN" : "URL_PREFIX",
            permissionLevel: p.permissionLevel,
            isSelected: isMatched,
          },
          update: {
            googleConnectionId: googleConn.id,
            permissionLevel: p.permissionLevel,
            isSelected: isMatched,
          },
        });
      }

      if (!chosenGscProperty && gscProps.length > 0) {
        chosenGscProperty = gscProps[0]!.siteUrl;
      }

      for (const g of ga4Props) {
        const isMatched = targetDomain ? (g.propertyName?.toLowerCase().includes(targetDomain) ?? false) : false;
        if (isMatched && !chosenGa4PropertyId) chosenGa4PropertyId = g.propertyId;
        await prisma.ga4Property.upsert({
          where: { websiteId_propertyId: { websiteId, propertyId: g.propertyId } },
          create: {
            websiteId,
            googleConnectionId: googleConn.id,
            accountId: g.accountId,
            propertyId: g.propertyId,
            propertyName: g.propertyName,
            isSelected: isMatched,
          },
          update: {
            googleConnectionId: googleConn.id,
            propertyName: g.propertyName,
            isSelected: isMatched,
          },
        });
      }

      if (!chosenGa4PropertyId && ga4Props.length > 0) {
        chosenGa4PropertyId = ga4Props[0]!.propertyId;
      }
    } catch {
      // Discovery failure is non-fatal
    }

    const finalGsc = chosenGscProperty || website?.gscProperty || website?.url || null;
    if (finalGsc) {
      await prisma.integration.upsert({
        where: {
          websiteId_kind_provider: {
            websiteId,
            kind: "GSC",
            provider: "google_search_console",
          },
        },
        create: {
          websiteId,
          kind: "GSC",
          provider: "google_search_console",
          externalId: finalGsc,
          status: "ACTIVE",
          lastSyncAt: new Date(),
        },
        update: {
          externalId: finalGsc,
          status: "ACTIVE",
          lastSyncAt: new Date(),
        },
      });
    }

    if (chosenGa4PropertyId) {
      await prisma.integration.upsert({
        where: {
          websiteId_kind_provider: {
            websiteId,
            kind: "GA4",
            provider: "google_analytics",
          },
        },
        create: {
          websiteId,
          kind: "GA4",
          provider: "google_analytics",
          externalId: chosenGa4PropertyId,
          status: "ACTIVE",
          lastSyncAt: new Date(),
        },
        update: {
          externalId: chosenGa4PropertyId,
          status: "ACTIVE",
          lastSyncAt: new Date(),
        },
      });
    }

    await prisma.website.update({
      where: { id: websiteId },
      data: {
        ...(finalGsc ? { gscProperty: finalGsc } : {}),
        ...(chosenGa4PropertyId ? { ga4PropertyId: chosenGa4PropertyId } : {}),
      },
    });

    // Sync real Google Search Console & GA4 rows for this website
    await Promise.all([
      syncDirectGoogleSearchConsole(websiteId, 28).catch(() => null),
      syncDirectGoogleAnalytics4(websiteId, 28).catch(() => null),
    ]);

    return NextResponse.redirect(new URL(`/?website=${encodeURIComponent(websiteId)}`, request.url));
  } catch (err: unknown) {
    return NextResponse.redirect(
      new URL(
        `/integrations/google?website=${encodeURIComponent(websiteId)}&error=${encodeURIComponent(err instanceof Error ? err.message : "OAuth Failed")}`,
        request.url,
      ),
    );
  }
}
