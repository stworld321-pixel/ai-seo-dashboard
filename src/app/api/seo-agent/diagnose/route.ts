import { NextRequest, NextResponse } from "next/server";
import { getUnifiedSearchAiBridges } from "@/server/services/seo-agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const websiteId = body.websiteId;

    if (!websiteId) {
      return NextResponse.json({ error: "websiteId is required" }, { status: 400 });
    }

    const bridges = await getUnifiedSearchAiBridges(websiteId);

    return NextResponse.json({
      data: {
        bridges,
        totalCount: bridges.length,
        activeCount: bridges.filter((b) => b.status === "OPEN").length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("SEO Agent diagnose error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run unified search-to-AI bridge diagnosis" },
      { status: 500 },
    );
  }
}
