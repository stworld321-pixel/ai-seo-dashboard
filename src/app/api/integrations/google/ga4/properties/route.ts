import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { getValidGoogleAccessToken, fetchGoogleAnalytics4Properties } from "@/server/integrations/google/oauth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);

  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const normalizedUrl = website.url.endsWith("/") ? website.url : `${website.url}/`;
  const domain = new URL(normalizedUrl).hostname.replace(/^www\./, "").toLowerCase();

  let properties = await prisma.ga4Property.findMany({
    where: { websiteId: website.id },
    orderBy: { isSelected: "desc" },
  });

  // If no properties cached or only 1, attempt live discovery from connected Google account
  const accessToken = await getValidGoogleAccessToken(website.id);
  if (accessToken && (properties.length === 0 || searchParams.get("refresh") === "true")) {
    try {
      const liveGa4 = await fetchGoogleAnalytics4Properties(accessToken);
      if (liveGa4.length > 0) {
        const conn = await prisma.googleConnection.findFirst({
          where: { status: "connected" },
          orderBy: { updatedAt: "desc" },
        });

        for (const g of liveGa4) {
          const isMatched = domain ? (g.propertyName?.toLowerCase().includes(domain) ?? false) : false;
          await prisma.ga4Property.upsert({
            where: {
              websiteId_propertyId: {
                websiteId: website.id,
                propertyId: g.propertyId,
              },
            },
            create: {
              websiteId: website.id,
              googleConnectionId: conn?.id || "oauth",
              accountId: g.accountId,
              propertyId: g.propertyId,
              propertyName: g.propertyName,
              isSelected: isMatched,
            },
            update: {
              googleConnectionId: conn?.id || "oauth",
              propertyName: g.propertyName,
              ...(isMatched ? { isSelected: true } : {}),
            },
          });
        }

        properties = await prisma.ga4Property.findMany({
          where: { websiteId: website.id },
          orderBy: { isSelected: "desc" },
        });
      }
    } catch {
      // Non-fatal
    }
  }

  if (properties.length === 0) {
    const defaultPropertyId = website.ga4PropertyId || null;

    if (defaultPropertyId) {
      const seeded = await prisma.ga4Property.upsert({
        where: {
          websiteId_propertyId: {
            websiteId: website.id,
            propertyId: defaultPropertyId,
          },
        },
        create: {
          websiteId: website.id,
          googleConnectionId: "site-kit-ga4",
          propertyId: defaultPropertyId,
          propertyName: `${website.name} (${domain})`,
          accountId: "default-account",
          isSelected: true,
        },
        update: {
          isSelected: true,
        },
      });
      properties = [seeded];
    }
  }

  const recommended = properties.find((p) => p.propertyName?.toLowerCase().includes(domain));
  const chosenPropertyId =
    website.ga4PropertyId ||
    recommended?.propertyId ||
    properties.find((p) => p.isSelected)?.propertyId ||
    properties[0]?.propertyId;

  return NextResponse.json({
    data: {
      properties,
      recommendedPropertyId: chosenPropertyId,
    },
  });
}
