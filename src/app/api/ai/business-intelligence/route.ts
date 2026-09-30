import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { getWebsiteBusinessIntelligence } from "@/server/services/business-intelligence";
import { getDefaultWebsite } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const websiteIdParam = searchParams.get("websiteId") || undefined;

  const website = await getDefaultWebsite(websiteIdParam);
  if (!website) {
    return NextResponse.json({ error: { message: "No active website found" } }, { status: 404 });
  }

  try {
    const data = await getWebsiteBusinessIntelligence(website.id);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Failed to load business intelligence." } },
      { status: 500 },
    );
  }
}
