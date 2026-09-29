import { NextResponse } from "next/server";
import { analyzeWebsiteUrl } from "@/server/intelligence/technology-detector";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { url?: string };
  if (!body.url || !body.url.trim()) {
    return NextResponse.json({ error: { message: "Website URL is required." } }, { status: 400 });
  }

  try {
    const analysis = await analyzeWebsiteUrl(body.url);
    return NextResponse.json({ data: analysis });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Failed to analyze website." } },
      { status: 500 },
    );
  }
}
