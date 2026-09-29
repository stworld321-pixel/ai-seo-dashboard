import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { executePromptRun, runWeeklyAudit } from "@/server/services/ai-visibility";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    promptId?: string;
    websiteId?: string;
    runAll?: boolean;
    engines?: Array<"chatgpt" | "claude" | "perplexity" | "gemini">;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const engines =
    body.engines && body.engines.length > 0
      ? body.engines
      : (["chatgpt", "claude", "perplexity", "gemini"] as const);

  if (body.runAll || body.promptId === "all") {
    const prompts = await prisma.aiPrompt.findMany({
      where: { websiteId: website.id, status: "active" },
    });

    const allResults = [];
    for (const p of prompts) {
      for (const eng of engines) {
        try {
          const res = await executePromptRun(p.id, eng, {
            id: website.id,
            name: website.name,
            url: website.url,
          });
          allResults.push(res);
        } catch (e: unknown) {
          allResults.push({
            promptId: p.id,
            engine: eng,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    try {
      await runWeeklyAudit(website.id);
    } catch {
      // Ignore background audit error
    }

    return NextResponse.json({
      data: {
        totalPrompts: prompts.length,
        totalRuns: allResults.length,
        results: allResults,
      },
    });
  }

  if (!body.promptId) {
    return NextResponse.json({ error: { message: "promptId is required" } }, { status: 400 });
  }

  const results = [];
  for (const eng of engines) {
    try {
      const res = await executePromptRun(body.promptId, eng, {
        id: website.id,
        name: website.name,
        url: website.url,
      });
      results.push(res);
    } catch (e: unknown) {
      results.push({
        engine: eng,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  try {
    await runWeeklyAudit(website.id);
  } catch {
    // Ignore background audit error
  }

  return NextResponse.json({
    data: {
      promptId: body.promptId,
      results,
    },
  });
}
