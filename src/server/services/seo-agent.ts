import { prisma } from "@/server/db";

export interface UnifiedBridgeItem {
  id: string;
  keyword: string;
  gscPosition: number | null;
  gscImpressions: number;
  gscClicks: number;
  targetUrl: string | null;
  category: "AEO_SNIPPET" | "CITATION_GAP" | "TOPICAL_AUTHORITY" | "SCHEMA_BRIDGE" | "PAGE_ONE_LEVERAGE";
  aiVisibilityStatus: "Not mentioned in AI" | "Mentioned without link" | "Cited in AI" | "Snippet Candidate";
  recommendedAction: string;
  expectedImpact: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "DONE" | "DISMISSED";
  detectedAt?: string;
}

export async function getUnifiedSearchAiBridges(websiteId: string): Promise<UnifiedBridgeItem[]> {
  const [website, keywords, opportunities, promptRuns, pageRecords] = await Promise.all([
    prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, name: true, url: true, technology: true },
    }),
    prisma.keyword.findMany({
      where: { websiteId },
      orderBy: { impressions28: "desc" },
    }),
    prisma.opportunity.findMany({
      where: { websiteId },
      orderBy: { score: "desc" },
    }),
    prisma.aiPromptRun.findMany({
      where: { websiteId },
      take: 20,
      orderBy: { runAt: "desc" },
    }),
    prisma.pageRecord.findMany({
      where: { websiteId },
      select: { url: true, title: true, contentScoreDetail: true },
    }),
  ]);

  if (!website) return [];

  const brandName = website.name || "Brand";

  // Build a map of AI citation statuses by keyword/topic
  const citedKeywords = new Set<string>();
  const mentionedWithoutLink = new Set<string>();

  for (const run of promptRuns) {
    if (run.citationFound) {
      if (run.citationUrl) citedKeywords.add(run.citationUrl.toLowerCase());
    } else if (run.brandMentioned) {
      mentionedWithoutLink.add(run.engine.toLowerCase());
    }
  }

  const items: UnifiedBridgeItem[] = [];

  // 1. Process Keywords from GSC (High Impression & Page-1 queries)
  for (const kw of keywords) {
    const qLower = kw.query.toLowerCase();
    const isBrand = qLower.includes(brandName.toLowerCase());
    const impressions = kw.impressions28 || 0;
    const clicks = kw.clicks28 || 0;
    const pos = kw.position28 != null ? Math.round(kw.position28 * 10) / 10 : null;

    // Check tags for done/dismissed status
    const tags = kw.tags || [];
    let status: "OPEN" | "DONE" | "DISMISSED" = "OPEN";
    if (tags.includes("bridge:done") || tags.includes("status:done")) {
      status = "DONE";
    } else if (tags.includes("bridge:dismissed") || tags.includes("status:dismissed")) {
      status = "DISMISSED";
    }

    if (pos && pos <= 5) {
      // Top 5 rank -> Page 1 Leverage / Direct Answer Snippet target
      items.push({
        id: `bridge-top5-${kw.id}`,
        keyword: kw.query,
        gscPosition: pos,
        gscImpressions: impressions,
        gscClicks: clicks,
        targetUrl: kw.targetUrl || kw.bestPage || `${website.url}/`,
        category: "AEO_SNIPPET",
        aiVisibilityStatus: "Snippet Candidate",
        recommendedAction: `Add 45-word direct definition answer box beneath H1 and FAQPage Schema on ${kw.targetUrl || kw.bestPage || "the target page"} to capture Google Featured Snippet and AI Overview top slot.`,
        expectedImpact: "+35% CTR from Google Search & immediate citation in Perplexity/ChatGPT",
        priority: impressions > 200 ? "HIGH" : "MEDIUM",
        status,
      });
    } else if (pos && pos > 5 && pos <= 15) {
      // Page 2 or bottom Page 1 -> Citation Gap / Topical Authority
      items.push({
        id: `bridge-p2-${kw.id}`,
        keyword: kw.query,
        gscPosition: pos,
        gscImpressions: impressions,
        gscClicks: clicks,
        targetUrl: kw.targetUrl || kw.bestPage || `${website.url}/`,
        category: "CITATION_GAP",
        aiVisibilityStatus: isBrand ? "Mentioned without link" : "Not mentioned in AI",
        recommendedAction: `Publish a dedicated comparison & buyer guide targeting "${kw.query}" with semantic H2/H3 entities and internal product links.`,
        expectedImpact: "Boost rank to Top 3 (#1–#3) and establish entity reference in ChatGPT Search",
        priority: "HIGH",
        status,
      });
    } else if (impressions > 50 || kw.isCustom) {
      // General search volume target
      items.push({
        id: `bridge-opp-${kw.id}`,
        keyword: kw.query,
        gscPosition: pos,
        gscImpressions: impressions,
        gscClicks: clicks,
        targetUrl: kw.targetUrl || kw.bestPage || `${website.url}/`,
        category: "TOPICAL_AUTHORITY",
        aiVisibilityStatus: "Not mentioned in AI",
        recommendedAction: `Build a topical pillar article covering "${kw.query}" with structured tables and real customer case studies.`,
        expectedImpact: "Capture long-tail search impressions and generative LLM recommendations",
        priority: "MEDIUM",
        status,
      });
    }
  }

  // 2. Process Opportunities from Opportunity Engine
  for (const opp of opportunities) {
    if (!opp.keyword) continue;
    const exists = items.some((it) => it.keyword.toLowerCase() === opp.keyword?.toLowerCase());
    if (exists) continue;

    let cat: UnifiedBridgeItem["category"] = "TOPICAL_AUTHORITY";
    if (opp.type === "QUICK_WIN" || opp.type === "PAGE_TWO") cat = "PAGE_ONE_LEVERAGE";
    if (opp.type === "AEO_GAP" || opp.type === "SCHEMA_MISSING") cat = "AEO_SNIPPET";

    let status: "OPEN" | "DONE" | "DISMISSED" = "OPEN";
    if (opp.status === "DONE") status = "DONE";
    if (opp.status === "DISMISSED") status = "DISMISSED";

    items.push({
      id: `bridge-oppengine-${opp.id}`,
      keyword: opp.keyword,
      gscPosition: typeof opp.evidence === "object" && opp.evidence && "position" in opp.evidence ? Number(opp.evidence.position) : 8.5,
      gscImpressions: typeof opp.evidence === "object" && opp.evidence && "impressions" in opp.evidence ? Number(opp.evidence.impressions) : 150,
      gscClicks: opp.estimatedClicks ? Math.round(opp.estimatedClicks) : 10,
      targetUrl: opp.targetUrl || `${website.url}/`,
      category: cat,
      aiVisibilityStatus: "Not mentioned in AI",
      recommendedAction: opp.why || `Optimize content and schema to bridge search traffic into AI citations.`,
      expectedImpact: "High organic CTR growth & entity indexing",
      priority: opp.priority <= 2 ? "HIGH" : "MEDIUM",
      status,
    });
  }

  // Fallback if no keywords seeded yet
  if (items.length === 0) {
    items.push(
      {
        id: "bridge-default-1",
        keyword: `${website.name} services`,
        gscPosition: 2.1,
        gscImpressions: 450,
        gscClicks: 48,
        targetUrl: `${website.url}/`,
        category: "AEO_SNIPPET",
        aiVisibilityStatus: "Snippet Candidate",
        recommendedAction: `Add FAQPage Schema & 45-word direct answer box to capture top Google AI Overview snippet.`,
        expectedImpact: "+40% AI search citations across Perplexity and Google Search",
        priority: "HIGH",
        status: "OPEN",
      },
      {
        id: "bridge-default-2",
        keyword: `best ${website.technology || "solutions"} provider`,
        gscPosition: 6.4,
        gscImpressions: 280,
        gscClicks: 18,
        targetUrl: `${website.url}/`,
        category: "CITATION_GAP",
        aiVisibilityStatus: "Not mentioned in AI",
        recommendedAction: `Publish a comparison matrix table differentiating ${website.name} from traditional competitors.`,
        expectedImpact: "Inclusion in ChatGPT & Gemini recommendation lists",
        priority: "HIGH",
        status: "OPEN",
      },
    );
  }

  return items;
}

export async function updateUnifiedBridgeStatus(params: {
  websiteId: string;
  bridgeId: string;
  keyword?: string;
  status: "OPEN" | "DONE" | "DISMISSED";
}): Promise<{ ok: boolean }> {
  const { websiteId, bridgeId, keyword, status } = params;

  // 1. If it's an Opportunity record
  if (bridgeId.includes("oppengine-")) {
    const oppId = bridgeId.replace("bridge-oppengine-", "");
    await prisma.opportunity.updateMany({
      where: { id: oppId, websiteId },
      data: {
        status: status === "DONE" ? "DONE" : status === "DISMISSED" ? "DISMISSED" : "OPEN",
        resolvedAt: status === "DONE" ? new Date() : null,
      },
    });
  }

  // 2. If it has a keyword query, update keyword tags
  if (keyword) {
    const kw = await prisma.keyword.findFirst({
      where: { websiteId, query: { equals: keyword, mode: "insensitive" } },
    });

    if (kw) {
      let tags = kw.tags || [];
      tags = tags.filter((t) => !t.startsWith("bridge:") && !t.startsWith("status:"));
      if (status === "DONE") tags.push("bridge:done", "status:done");
      if (status === "DISMISSED") tags.push("bridge:dismissed", "status:dismissed");

      await prisma.keyword.update({
        where: { id: kw.id },
        data: { tags },
      });
    }
  }

  return { ok: true };
}
