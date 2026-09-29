import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { runFullAiVisibilityAudit, runWeeklyAudit } from "@/server/services/ai-visibility";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const audits = await prisma.weeklyAiAudit.findMany({
    where: { websiteId: website.id },
    orderBy: { weekStart: "desc" },
    include: {
      results: {
        include: { prompt: true },
      },
    },
  });

  return NextResponse.json({ data: audits });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const res = await runFullAiVisibilityAudit(website.id);
    return NextResponse.json({ data: res.audit, promptsTested: res.promptsTested });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : String(err) } },
      { status: 500 },
    );
  }
}
