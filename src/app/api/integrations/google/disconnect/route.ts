import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  await Promise.all([
    prisma.googleConnection.deleteMany({ where: { websiteId: website.id } }),
    prisma.gscProperty.deleteMany({ where: { websiteId: website.id } }),
    prisma.ga4Property.deleteMany({ where: { websiteId: website.id } }),
  ]);

  return NextResponse.json({ success: true, message: "Google account disconnected." });
}
