import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { syncDirectGoogleSearchConsole } from "@/server/integrations/google/gsc";
import { syncDirectGoogleAnalytics4 } from "@/server/integrations/google/ga4";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const [gscResult, ga4Result] = await Promise.all([
    syncDirectGoogleSearchConsole(website.id),
    syncDirectGoogleAnalytics4(website.id),
  ]);

  return NextResponse.json({
    data: {
      gsc: gscResult,
      ga4: ga4Result,
    },
  });
}
