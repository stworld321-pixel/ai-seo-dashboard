import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    propertyUrl: string;
  };

  if (!body.propertyUrl) {
    return NextResponse.json({ error: { message: "propertyUrl is required" } }, { status: 400 });
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  // Deselect other properties and select the chosen one
  await prisma.gscProperty.updateMany({
    where: { websiteId: website.id },
    data: { isSelected: false },
  });

  const property = await prisma.gscProperty.upsert({
    where: {
      websiteId_propertyUrl: {
        websiteId: website.id,
        propertyUrl: body.propertyUrl,
      },
    },
    create: {
      websiteId: website.id,
      googleConnectionId: (await prisma.googleConnection.findFirst({ where: { websiteId: website.id } }))?.id || "temp",
      propertyUrl: body.propertyUrl,
      propertyType: body.propertyUrl.startsWith("sc-domain:") ? "DOMAIN" : "URL_PREFIX",
      isSelected: true,
    },
    update: {
      isSelected: true,
    },
  });

  await prisma.website.update({
    where: { id: website.id },
    data: { gscProperty: body.propertyUrl },
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
      externalId: body.propertyUrl,
      status: "ACTIVE",
      lastSyncAt: new Date(),
    },
    update: {
      externalId: body.propertyUrl,
      status: "ACTIVE",
      lastSyncAt: new Date(),
    },
  });

  return NextResponse.json({ data: property });
}
