import { NextRequest, NextResponse } from "next/server";
import { updateUnifiedBridgeStatus } from "@/server/services/seo-agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { websiteId, bridgeId, keyword, status } = body as {
      websiteId: string;
      bridgeId: string;
      keyword?: string;
      status: "OPEN" | "DONE" | "DISMISSED";
    };

    if (!websiteId || !bridgeId || !status) {
      return NextResponse.json(
        { error: "websiteId, bridgeId, and status ('OPEN' | 'DONE' | 'DISMISSED') are required" },
        { status: 400 },
      );
    }

    const result = await updateUnifiedBridgeStatus({
      websiteId,
      bridgeId,
      keyword,
      status,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("SEO Agent status update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update bridge status" },
      { status: 500 },
    );
  }
}
