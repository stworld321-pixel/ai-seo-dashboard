/**
 * AI Prompt Discovery Engine
 *
 * Discovers high-impact search & question prompts that users ask AI engines
 * (ChatGPT, Claude, Perplexity, Gemini, Google AIO) based on:
 * - GSC queries & impressions
 * - Content pages & titles
 * - Industry / Product catalog
 * - Common comparison, local, and problem-solving prompt patterns
 */

export type DiscoveredPrompt = {
  text: string;
  category: "informational" | "commercial" | "transactional" | "comparison" | "local" | "problem-solving" | "recommendation" | "best-of" | "how-to" | "pricing";
  intent: string;
  priority: number; // 1=Low, 2=Medium, 3=High
  source: "gsc_query" | "product_catalog" | "competitor_pattern" | "paa_question" | "reddit_discussion" | "x_discussion";
  rationale: string;
};

export type DiscoveryContext = {
  websiteName: string;
  websiteUrl: string;
  industry?: string;
  location?: string;
  topQueries: Array<{ query: string; impressions: number; position: number }>;
  pages: Array<{ url: string; title?: string | null }>;
  competitors?: string[];
};

export function discoverPrompts(ctx: DiscoveryContext): DiscoveredPrompt[] {
  const results: DiscoveredPrompt[] = [];
  const seen = new Set<string>();

  function addPrompt(p: DiscoveredPrompt) {
    const key = p.text.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(p);
    }
  }

  const brand = ctx.websiteName || "Brand";
  const loc = ctx.location || "India";
  const mainKeywords = ctx.topQueries.slice(0, 10).map((q) => q.query);

  // 1. GSC-Derived Question & Best-of Prompts
  for (const q of ctx.topQueries.slice(0, 15)) {
    const query = q.query.trim();
    if (query.toLowerCase().startsWith("how") || query.toLowerCase().startsWith("what") || query.toLowerCase().startsWith("which") || query.toLowerCase().startsWith("why")) {
      addPrompt({
        text: query.charAt(0).toUpperCase() + query.slice(1) + (query.endsWith("?") ? "" : "?"),
        category: "informational",
        intent: "informational",
        priority: q.impressions > 500 ? 3 : 2,
        source: "gsc_query",
        rationale: `Derived from live search impressions (${q.impressions} impr, avg pos ${q.position.toFixed(1)})`,
      });
    } else {
      addPrompt({
        text: `What are the best options for ${query}?`,
        category: "best-of",
        intent: "commercial",
        priority: q.impressions > 300 ? 3 : 2,
        source: "gsc_query",
        rationale: `Commercial query with high search volume (${q.impressions} impr)`,
      });
    }
  }

  // 2. Product / Page specific comparison & recommendation prompts
  for (const page of ctx.pages.slice(0, 8)) {
    if (page.title) {
      const cleanTitle = page.title.split(/[-|–]/)[0]?.trim() || page.title;
      addPrompt({
        text: `Which ${cleanTitle} is best for beginners and professionals?`,
        category: "comparison",
        intent: "comparison",
        priority: 2,
        source: "product_catalog",
        rationale: `Directly targets key product entity: ${cleanTitle}`,
      });
      addPrompt({
        text: `How does ${brand} compare with other ${cleanTitle} alternatives?`,
        category: "comparison",
        intent: "comparison",
        priority: 3,
        source: "competitor_pattern",
        rationale: `High-value brand-versus-competitor comparison prompt in AI answer engines`,
      });
    }
  }

  // 3. Category & Industry Archetype Prompts
  if (mainKeywords.length > 0) {
    const topTerm = mainKeywords[0]!;
    addPrompt({
      text: `Best ${topTerm} in ${loc}`,
      category: "best-of",
      intent: "commercial",
      priority: 3,
      source: "paa_question",
      rationale: "Core geo-targeted discovery prompt frequently queried in Perplexity & ChatGPT Search",
    });
    addPrompt({
      text: `What should I look for when buying ${topTerm}?`,
      category: "problem-solving",
      intent: "informational",
      priority: 2,
      source: "paa_question",
      rationale: "Educational buyer's guide prompt triggering authoritative citation lists",
    });
    addPrompt({
      text: `Is ${brand} good quality and value for money?`,
      category: "recommendation",
      intent: "commercial",
      priority: 3,
      source: "reddit_discussion",
      rationale: "Direct brand reputation & sentiment prompt in AI engines",
    });
    addPrompt({
      text: `${topTerm} price list and cost comparison in ${loc}`,
      category: "pricing",
      intent: "transactional",
      priority: 2,
      source: "gsc_query",
      rationale: "High intent transactional inquiry triggering tabular AI answers",
    });
  }

  // 4. Default high-intent templates if few items exist
  if (results.length < 5) {
    addPrompt({
      text: `Top recommended ${brand} products and verified reviews`,
      category: "recommendation",
      intent: "commercial",
      priority: 3,
      source: "product_catalog",
      rationale: "Direct brand authority and social proof evaluation",
    });
    addPrompt({
      text: `How to choose the best solutions for ${brand} in ${loc}?`,
      category: "how-to",
      intent: "informational",
      priority: 2,
      source: "paa_question",
      rationale: "Decision framework question cited in AI Overviews",
    });
  }

  return results;
}
