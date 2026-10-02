import { NextResponse } from "next/server";
import { getCurrentUser, getOwnedWebsite } from "@/server/auth";
import { prisma } from "@/server/db";
import { getWebsiteBusinessIntelligence } from "@/server/services/business-intelligence";
import { getConfiguredAiModels } from "@/server/integrations/llm/provider";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { websiteId?: string };
  if (!body.websiteId) {
    return NextResponse.json({ error: { message: "websiteId is required" } }, { status: 400 });
  }

  // Resolve through the ownership check: an authenticated user must not be able
  // to analyse another tenant's site by passing its id.
  const website = await getOwnedWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  try {
    const bi = await getWebsiteBusinessIntelligence(website.id);

    // If an OpenAI or Gemini API key is configured, perform LLM enrichment
    const models = await getConfiguredAiModels(website.id);
    const active = models.find((m) => m.isActive) ?? models[0];

    if (active && active.provider === "openai" && process.env.OPENAI_API_KEY) {
      try {
        const pages = await prisma.pageRecord.findMany({ where: { websiteId: website.id }, take: 8 });
        const pagesSummary = pages.map((p) => `${p.title}: ${p.metaDescription ?? ""}`).join("\n");

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: active.model || "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: "You are an elite product strategist and marketing analyst. Synthesize structured product intelligence from the given website data into JSON.",
              },
              {
                role: "user",
                content: `Analyze this product/website:\nName: ${website.name}\nURL: ${website.url}\nPages summary:\n${pagesSummary}\n\nReturn JSON matching keys:
productName, website, oneLiner, whatItDoes, productCategory, productType, targetCustomers (array of strings), keyFeatures (array of strings), businessModel.`,
              },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
          if (parsed.oneLiner) {
            bi.productInfo = {
              ...bi.productInfo,
              ...parsed,
              productName: parsed.productName || bi.productInfo.productName,
              website: bi.productInfo.website,
              techSignals: bi.productInfo.techSignals,
              analyzedAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Fall back to the structured deterministic intelligence
      }
    }

    return NextResponse.json({ data: bi });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Failed to analyze product." } },
      { status: 500 },
    );
  }
}
