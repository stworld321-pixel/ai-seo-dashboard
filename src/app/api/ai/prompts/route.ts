import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const prompts = await prisma.aiPrompt.findMany({
    where: { websiteId: website.id },
    include: {
      runs: {
        orderBy: { runAt: "desc" },
        take: 5,
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ data: prompts });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    text: string;
    country?: string;
    language?: string;
    location?: string;
    industry?: string;
    intent?: string;
    priority?: number;
    source?: string;
  };

  if (!body.text || !body.text.trim()) {
    return NextResponse.json({ error: { message: "Prompt text is required" } }, { status: 400 });
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const prompt = await prisma.aiPrompt.upsert({
    where: {
      websiteId_text: {
        websiteId: website.id,
        text: body.text.trim(),
      },
    },
    create: {
      websiteId: website.id,
      text: body.text.trim(),
      country: body.country,
      language: body.language || "en",
      location: body.location,
      industry: body.industry,
      intent: body.intent || "informational",
      priority: body.priority || 2,
      source: body.source || "manual",
      approved: true,
      status: "active",
    },
    update: {
      country: body.country,
      language: body.language,
      location: body.location,
      industry: body.industry,
      intent: body.intent,
      priority: body.priority,
      status: "active",
    },
  });

  return NextResponse.json({ data: prompt });
}
