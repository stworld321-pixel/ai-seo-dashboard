import { prisma } from "@/server/db";
import { decryptJson } from "@/server/crypto";
import { classifyIntent } from "@/server/intelligence/intent";
import { buildDataDrivenDraft, scoreContent } from "@/server/intelligence/content-scorer";

export type AiProviderId = "openai" | "anthropic" | "gemini" | "custom";

export type ConfiguredAiModel = {
  id: string;
  provider: AiProviderId;
  providerLabel: string;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
  hasApiKey: boolean;
  updatedAt: string;
};

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: "ChatGPT (OpenAI)",
  anthropic: "Claude (Anthropic)",
  gemini: "Gemini (Google AI)",
  custom: "Custom / OpenRouter",
};

export const SUGGESTED_MODELS: Record<AiProviderId, string[]> = {
  openai: ["gpt-4o", "gpt-4.1", "gpt-4o-mini", "o3-mini"],
  anthropic: [
    "claude-sonnet-4-5",
    "claude-3-7-sonnet-latest",
    "claude-opus-4-1",
    "claude-3-5-haiku-latest",
  ],
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  custom: ["openai/gpt-4o", "anthropic/claude-3.7-sonnet", "google/gemini-2.5-pro"],
};

export async function getConfiguredAiModels(websiteId: string): Promise<ConfiguredAiModel[]> {
  const rows = await prisma.integration.findMany({
    where: {
      websiteId,
      kind: "LLM",
      provider: { in: ["openai", "anthropic", "gemini", "custom"] },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((r) => {
    const cfg = (r.config ?? {}) as {
      model?: string;
      baseUrl?: string | null;
      isActive?: boolean;
    };
    const provider = (r.provider as AiProviderId) || "openai";
    const envKeyPresent =
      (provider === "openai" && Boolean(process.env.OPENAI_API_KEY)) ||
      (provider === "anthropic" && Boolean(process.env.ANTHROPIC_API_KEY)) ||
      (provider === "gemini" && Boolean(process.env.GEMINI_API_KEY));

    return {
      id: r.id,
      provider,
      providerLabel: AI_PROVIDER_LABELS[provider] ?? r.provider,
      model: cfg.model || SUGGESTED_MODELS[provider]?.[0] || "gpt-4o",
      baseUrl: cfg.baseUrl ?? null,
      isActive: Boolean(cfg.isActive),
      hasApiKey: Boolean(r.secretCipher) || envKeyPresent,
      updatedAt: (r.lastSyncAt ?? r.createdAt).toISOString(),
    };
  });
}

export async function generateWithConfiguredAi(input: {
  websiteId: string;
  providerOverride?: string;
  modelOverride?: string;
  keyword: string;
  customTitle?: string;
  secondaryKeywords: string[];
  targetUrl?: string | null;
  impressions?: number;
  position?: number;
}) {
  const website = await prisma.website.findUnique({
    where: { id: input.websiteId },
  });

  const pageRecords = await prisma.pageRecord.findMany({
    where: { websiteId: input.websiteId },
    take: 6,
  });

  const brandName = website?.name?.trim() || "Our Brand";
  const siteUrl = (website?.url?.trim() || "https://example.com").replace(/\/+$/, "");

  const internalLinks =
    pageRecords.length > 0
      ? pageRecords.map((p) => ({
          anchor: p.title?.slice(0, 40) || `${brandName} ${p.url.split("/").filter(Boolean).pop() || "Page"}`,
          url: p.url,
        }))
      : [
          { anchor: `${brandName} Home`, url: siteUrl },
          { anchor: `Services & Solutions`, url: `${siteUrl}/services` },
        ];

  const baseDraft = buildDataDrivenDraft({
    keyword: input.keyword,
    customTitle: input.customTitle,
    secondaryKeywords: input.secondaryKeywords,
    targetUrl: input.targetUrl,
    impressions: input.impressions,
    position: input.position,
    websiteName: brandName,
    websiteUrl: siteUrl,
    websiteCountry: website?.country,
    internalLinks,
  });

  const llmIntegrations = await prisma.integration.findMany({
    where: { websiteId: input.websiteId, kind: "LLM" },
    orderBy: { createdAt: "asc" },
  });

  const chosen =
    (input.providerOverride
      ? llmIntegrations.find((i) => i.provider === input.providerOverride)
      : undefined) ??
    llmIntegrations.find((i) => Boolean((i.config as { isActive?: boolean })?.isActive)) ??
    llmIntegrations[0];

  const provider = (input.providerOverride ?? chosen?.provider ?? "deterministic") as string;
  const cfg = (chosen?.config ?? {}) as { model?: string; baseUrl?: string | null };
  const modelName =
    input.modelOverride?.trim() ||
    cfg.model?.trim() ||
    (provider !== "deterministic"
      ? SUGGESTED_MODELS[provider as AiProviderId]?.[0] ?? "default"
      : "deterministic-engine");

  let apiKey: string | undefined;
  if (chosen?.secretCipher && chosen?.secretIv && chosen?.secretTag) {
    try {
      const dec = decryptJson<{ apiKey?: string }>({
        cipher: chosen.secretCipher as Uint8Array<ArrayBuffer>,
        iv: chosen.secretIv as Uint8Array<ArrayBuffer>,
        tag: chosen.secretTag as Uint8Array<ArrayBuffer>,
      });
      apiKey = dec.apiKey;
    } catch {
      // Ignore decryption mismatch
    }
  }
  if (!apiKey) {
    if (provider === "openai") apiKey = process.env.OPENAI_API_KEY;
    else if (provider === "anthropic") apiKey = process.env.ANTHROPIC_API_KEY;
    else if (provider === "gemini") apiKey = process.env.GEMINI_API_KEY;
  }

  const authorAgent =
    provider === "deterministic" ? "content-writer" : `${provider}:${modelName}`;

  if (!apiKey || provider === "deterministic") {
    return {
      ...baseDraft,
      authorAgent,
      modelUsed: `${AI_PROVIDER_LABELS[provider as AiProviderId] ?? provider} (${modelName})`,
    };
  }

  const internalLinksText = baseDraft.brief.internalLinksIncluded
    .map((l) => `[${l.anchor}](${l.url})`)
    .join(", ");

  const prompt = `Write a Page-1 ranking, SEO + AEO (Answer Engine Optimization) + GEO (Generative Engine Optimization) markdown blog post for ${brandName} (${siteUrl}).

Exact H1 Title: # ${baseDraft.title}
Primary Focus Keyword: "${input.keyword}"
Secondary Keywords: ${baseDraft.secondaryKeywords.join(", ")}
Contextual Internal Links to Include Naturally: ${internalLinksText}
Search Console Metric Context: ${input.impressions ?? 0} impressions, average rank ${input.position ? input.position.toFixed(1) : "N/A"}.

Mandatory Structure for Google Page-1 + AEO + GEO Ranking:
1. Start with \`# ${baseDraft.title}\` followed immediately by a blockquote \`> **Quick Answer (AEO Featured Snippet):** ...\` (45–55 words directly answering the search intent and mentioning "${input.keyword}" in the first 100 words).
2. Include \`## Key Takeaways (GEO Entity & Citation Summary)\` with 4 factual bullet points tailored to ${brandName} and linking to (${internalLinksText}).
3. Include 3 deep, authoritative \`##\` H2 sections specifically detailing services, client benefits, quality standards, and practical guidance relevant to "${input.keyword}".
4. Include a structured Markdown comparison table (\`## Comparison: ${brandName} vs. Competitors\`).
5. Include \`## Frequently Asked Questions (FAQ)\` with 4 \`### Question?\` subheadings and clear 40-word answers directly addressing common user queries about "${input.keyword}".
6. Strict QA rules: Do NOT invent unsourced statistics. Keep exact occurrences of "${input.keyword}" between 3 and 5 times so keyword density stays under 3.0%.`;

  try {
    let generatedBody: string | null = null;

    if (provider === "openai" || provider === "custom") {
      const endpoint = `${(cfg.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "system",
              content: `You are an elite SEO, AEO (Featured Snippet), and GEO (AI Overview / LLM citation) content strategist for ${brandName}. Never fabricate statistics or exceed 3.5% keyword density. Always write highly relevant, authentic content matching the brand's true domain.`,
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        generatedBody = data.choices?.[0]?.message?.content?.trim() ?? null;
      }
    } else if (provider === "anthropic") {
      const endpoint = `${(cfg.baseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "")}/messages`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 1800,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          content?: { type: string; text?: string }[];
        };
        generatedBody = data.content?.find((c) => c.type === "text")?.text?.trim() ?? null;
      }
    } else if (provider === "gemini") {
      const base = (cfg.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(
        /\/+$/,
        "",
      );
      const endpoint = `${base}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        generatedBody =
          data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
      }
    }

    if (generatedBody && generatedBody.length > 200) {
      const qa = scoreContent({
        keyword: input.keyword,
        title: baseDraft.title,
        metaDescription: baseDraft.metaDescription,
        body: generatedBody,
      });
      if (qa.qaPassed) {
        const { intent } = classifyIntent(input.keyword);
        return {
          ...baseDraft,
          intent,
          body: generatedBody,
          qaReport: qa,
          authorAgent,
          modelUsed: `${AI_PROVIDER_LABELS[provider as AiProviderId] ?? provider} (${modelName})`,
        };
      }
    }
  } catch {
    // Fall back to deterministic QA-verified SEO+AEO+GEO draft if network/key fails
  }

  return {
    ...baseDraft,
    authorAgent,
    modelUsed: `${AI_PROVIDER_LABELS[provider as AiProviderId] ?? provider} (${modelName})`,
  };
}
