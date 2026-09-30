import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { runFullKeywordResearch } from "@/server/intelligence/keyword-research";
import { getCurrentUser } from "@/server/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    country?: string;
    language?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const result = await runFullKeywordResearch({
      websiteId: website.id,
      country: body.country,
      language: body.language,
    });

    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Keyword research pipeline failed" } },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId");

  const website = await getDefaultWebsite(websiteId ?? undefined);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const result = await runFullKeywordResearch({
      websiteId: website.id,
      maxPagesToCrawl: 15,
    });

    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Failed to load keyword research data" } },
      { status: 500 },
    );
  }
}
