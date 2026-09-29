import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import {
  getAiVisibilityMetrics,
  getEngineComparison,
  getWhatShouldIDoNext,
} from "@/server/services/ai-visibility";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const [metrics, comparison, recommendations] = await Promise.all([
    getAiVisibilityMetrics(website.id),
    getEngineComparison(website.id),
    getWhatShouldIDoNext(website.id),
  ]);

  return NextResponse.json({
    data: {
      metrics,
      comparison,
      recommendations,
    },
  });
}
