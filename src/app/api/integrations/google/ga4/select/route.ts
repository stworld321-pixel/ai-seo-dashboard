import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    propertyId: string;
    propertyName?: string;
  };

  if (!body.propertyId) {
    return NextResponse.json({ error: { message: "propertyId is required" } }, { status: 400 });
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  // Deselect other properties and select the chosen one
  await prisma.ga4Property.updateMany({
    where: { websiteId: website.id },
    data: { isSelected: false },
  });

  const property = await prisma.ga4Property.upsert({
    where: {
      websiteId_propertyId: {
        websiteId: website.id,
        propertyId: body.propertyId,
      },
    },
    create: {
      websiteId: website.id,
      googleConnectionId: (await prisma.googleConnection.findFirst({ where: { websiteId: website.id } }))?.id || "temp",
      propertyId: body.propertyId,
      propertyName: body.propertyName,
      isSelected: true,
    },
    update: {
      isSelected: true,
      propertyName: body.propertyName,
    },
  });

  await prisma.website.update({
    where: { id: website.id },
    data: { ga4PropertyId: body.propertyId },
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
      externalId: body.propertyId,
      status: "ACTIVE",
      lastSyncAt: new Date(),
    },
    update: {
      externalId: body.propertyId,
      status: "ACTIVE",
      lastSyncAt: new Date(),
    },
  });

  return NextResponse.json({ data: property });
}
