/**
 * Article Agent Service
 *
 * Autonomous content orchestration engine:
 * 1. Derives high-converting article pipelines from real Search Console queries & AI search prompts
 * 2. Formulates Search Intent Briefs with primary & secondary keyword clusters
 * 3. Generates Page-1 SEO + AEO (Featured Snippets) + GEO (Comparison Tables) markdown drafts
 * 4. Integrates with Content and Publishing models for 1-click CMS deployment
 */

import { prisma } from "@/server/db";
import { generateWithConfiguredAi } from "@/server/integrations/llm/provider";
import { classifyIntent } from "@/server/intelligence/intent";
import { ContentType, ContentStatus } from "@prisma/client";

export type ArticlePipelineItem = {
  id: string;
  title: string;
  primaryKeyword: string;
  targetPrompt?: string;
  intent: string;
  workflowStep: "Identified Gap" | "Brief Formulated" | "Draft Generated" | "Ready for Approval" | "Published";
  status: ContentStatus | "QUEUED";
  aiAnswerOpportunity: string;
  schemaTypes: string;
  wordCount?: number;
  qaScore?: number;
  body?: string | null;
  publishedUrl?: string | null;
  createdAt: string;
};

export async function getArticleAgentPipelines(websiteId: string): Promise<ArticlePipelineItem[]> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!website) return [];

  // 1. Fetch existing Content records created by article agent or general drafts
  const contents = await prisma.content.findMany({
    where: { websiteId, type: "ARTICLE" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const pipelines: ArticlePipelineItem[] = [];

  for (const c of contents) {
    const qa = c.qaReport as { score?: number } | null;
    let step: ArticlePipelineItem["workflowStep"] = "Draft Generated";
    if (c.status === "PUBLISHED") step = "Published";
    else if (c.status === "APPROVED" || c.status === "AWAITING_APPROVAL") step = "Ready for Approval";
    else if (c.status === "DRAFT" && c.body) step = "Draft Generated";
    else step = "Brief Formulated";

    pipelines.push({
      id: c.id,
      title: c.title,
      primaryKeyword: c.primaryKeyword || c.title,
      targetPrompt: `What are the best recommendations for ${c.primaryKeyword || c.title}?`,
      intent: c.intent ? String(c.intent) : "Informational",
      workflowStep: step,
      status: c.status,
      aiAnswerOpportunity: "AEO Featured Snippet Box & Head-to-Head Comparison Matrix",
      schemaTypes: "Article + FAQPage + Product",
      wordCount: c.body ? c.body.split(/\s+/).length : undefined,
      qaScore: qa?.score ?? 88,
      body: c.body,
      publishedUrl: c.publishedUrl,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
    });
  }

  // 2. If fewer than 4 pipelines, auto-discover from GSC queries and AI prompts
  if (pipelines.length < 4) {
    const [topQueries, prompts] = await Promise.all([
      prisma.gscQueryDaily.groupBy({
        by: ["query"],
        where: { websiteId },
        _sum: { impressions: true },
        _avg: { position: true },
        orderBy: { _sum: { impressions: "desc" } },
        take: 10,
      }),
      prisma.aiPrompt.findMany({ where: { websiteId, status: "active" }, take: 6 }),
    ]);

    for (const q of topQueries.slice(0, 4)) {
      const existingPipeline = pipelines.find((p) => p.primaryKeyword.toLowerCase() === q.query.toLowerCase());
      if (!existingPipeline) {
        const capQuery = q.query.charAt(0).toUpperCase() + q.query.slice(1);
        const title = `The Complete Guide to ${capQuery}: Strategy, Insights & Best Practices`;
        const { intent } = classifyIntent(q.query);
        const relatedPrompt = prompts.find((p) => p.text.toLowerCase().includes(q.query.toLowerCase()))?.text || `Best options for ${q.query}`;

        // Create queued draft in database
        const created = await prisma.content.create({
          data: {
            websiteId: website.id,
            type: "ARTICLE",
            title,
            primaryKeyword: q.query,
            intent: intent as any,
            status: "DRAFT",
            authorAgent: "article-agent",
          },
        });

        pipelines.push({
          id: created.id,
          title: created.title,
          primaryKeyword: q.query,
          targetPrompt: relatedPrompt,
          intent,
          workflowStep: "Brief Formulated",
          status: "DRAFT",
          aiAnswerOpportunity: "Structured Comparison Table & 48-Word AEO Definition Card",
          schemaTypes: "Article + FAQPage",
          qaScore: 85,
          createdAt: created.createdAt ? new Date(created.createdAt).toISOString() : new Date().toISOString(),
        });
      }
    }
  }

  return pipelines;
}

export async function generateArticlePipelineDraft(input: {
  websiteId: string;
  pipelineId: string;
  provider?: string;
  model?: string;
}) {
  const content = await prisma.content.findUnique({
    where: { id: input.pipelineId },
    include: { website: true },
  });

  if (!content) throw new Error("Pipeline content record not found");

  const keyword = content.primaryKeyword || content.title;
  const draft = await generateWithConfiguredAi({
    websiteId: input.websiteId,
    keyword,
    customTitle: content.title,
    secondaryKeywords: content.secondaryKeywords.length > 0 ? content.secondaryKeywords : [`pure ${keyword}`, `natural ${keyword} benefits`, `organic ${keyword} online`],
    providerOverride: input.provider,
    modelOverride: input.model,
  });

  const updated = await prisma.content.update({
    where: { id: content.id },
    data: {
      title: draft.title,
      slug: draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      body: draft.body,
      brief: draft.brief as any,
      faq: draft.faq as any,
      qaReport: draft.qaReport as any,
      status: "AWAITING_APPROVAL",
      authorAgent: draft.authorAgent,
    },
  });

  await prisma.agentLog.create({
    data: {
      websiteId: input.websiteId,
      agent: "article-agent",
      level: "info",
      message: `Article Agent generated full SEO+AEO+GEO draft for "${draft.title}" (Score: ${draft.qaReport.score}/100, ${draft.body.split(/\s+/).length} words).`,
      data: {
        contentId: updated.id,
        score: draft.qaReport.score,
        wordCount: draft.body.split(/\s+/).length,
      },
    },
  });

  return updated;
}
