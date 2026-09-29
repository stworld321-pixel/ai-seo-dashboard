import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { getValidGoogleAccessToken, fetchGoogleSearchConsoleProperties } from "@/server/integrations/google/oauth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);

  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const normalizedUrl = website.url.endsWith("/") ? website.url : `${website.url}/`;
  const domain = new URL(normalizedUrl).hostname.replace(/^www\./, "").toLowerCase();

  let properties = await prisma.gscProperty.findMany({
    where: { websiteId: website.id },
    orderBy: { isSelected: "desc" },
  });

  // If no properties cached or only 1, attempt live discovery from connected Google account
  const accessToken = await getValidGoogleAccessToken(website.id);
  if (accessToken && (properties.length === 0 || searchParams.get("refresh") === "true")) {
    try {
      const liveProps = await fetchGoogleSearchConsoleProperties(accessToken);
      if (liveProps.length > 0) {
        const conn = await prisma.googleConnection.findFirst({
          where: { status: "connected" },
          orderBy: { updatedAt: "desc" },
        });

        for (const p of liveProps) {
          const isMatched = domain ? p.siteUrl.toLowerCase().includes(domain) : false;
          await prisma.gscProperty.upsert({
            where: {
              websiteId_propertyUrl: {
                websiteId: website.id,
                propertyUrl: p.siteUrl,
              },
            },
            create: {
              websiteId: website.id,
              googleConnectionId: conn?.id || "oauth",
              propertyUrl: p.siteUrl,
              propertyType: p.isDomain ? "DOMAIN" : "URL_PREFIX",
              permissionLevel: p.permissionLevel,
              isSelected: isMatched,
            },
            update: {
              googleConnectionId: conn?.id || "oauth",
              permissionLevel: p.permissionLevel,
              ...(isMatched ? { isSelected: true } : {}),
            },
          });
        }

        properties = await prisma.gscProperty.findMany({
          where: { websiteId: website.id },
          orderBy: { isSelected: "desc" },
        });
      }
    } catch {
      // Non-fatal if live discovery fails
    }
  }

  if (properties.length === 0 && website.gscProperty) {
    const primaryPropertyUrl = website.gscProperty;
    const seeded = await prisma.gscProperty.upsert({
      where: {
        websiteId_propertyUrl: {
          websiteId: website.id,
          propertyUrl: primaryPropertyUrl,
        },
      },
      create: {
        websiteId: website.id,
        googleConnectionId: "gsc-property",
        propertyUrl: primaryPropertyUrl,
        propertyType: primaryPropertyUrl.startsWith("sc-domain:") ? "DOMAIN" : "URL_PREFIX",
        permissionLevel: "siteOwner",
        isSelected: true,
      },
      update: {
        isSelected: true,
      },
    });
    properties = [seeded];
  }

  const recommended = properties.find((p) => p.propertyUrl.toLowerCase().includes(domain));
  const chosenPropertyUrl =
    website.gscProperty ||
    recommended?.propertyUrl ||
    properties.find((p) => p.isSelected)?.propertyUrl ||
    properties[0]?.propertyUrl ||
    normalizedUrl;

  return NextResponse.json({
    data: {
      properties,
      recommendedPropertyUrl: chosenPropertyUrl,
    },
  });
}
