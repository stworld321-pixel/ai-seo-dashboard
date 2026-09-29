/**
 * LLM-powered brand mention & citation extractor.
 *
 * Given an AI engine's response text and a target domain/brand name,
 * extracts:
 *   - Whether the brand/domain was mentioned
 *   - Whether the domain was cited as a source
 *   - Observed position/order in any list
 *   - Competitors mentioned
 *   - Source domains cited
 *   - Mention context (surrounding sentence)
 *   - Sentiment classification
 */

export type ExtractionInput = {
  responseText: string;
  brandDomain: string;   // e.g. "agnisteels.com"
  brandName: string;     // e.g. "Agni Steels"
  competitors?: string[]; // e.g. ["tata.com", "jsw.in"]
};

export type ExtractionResult = {
  brandMentioned: boolean;
  brandPosition: number | null;     // 1-based order if in a list, null if not in list
  citationFound: boolean;
  citationUrl: string | null;
  citationDomain: string | null;
  competitorsMentioned: string[];
  sourceDomains: string[];
  mentionContext: string | null;
  sentiment: "positive" | "neutral" | "negative" | "not_mentioned";
  confidence: number;
};

// Domain variants to search for (e.g. "agnisteels.com", "agnisteels", "Agni Steels")
function buildDomainVariants(domain: string, brandName: string): string[] {
  const bare = domain.replace(/^www\./, "").toLowerCase();
  return [
    bare,
    `www.${bare}`,
    `https://${bare}`,
    `https://www.${bare}`,
    brandName.toLowerCase(),
    brandName,
  ];
}

function extractSourceDomains(text: string): string[] {
  // Match URLs in markdown links, plain URLs, or after "Source:" patterns
  const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const domains = new Set<string>();
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    domains.add(match[1]!.toLowerCase().replace(/^www\./, ""));
  }
  return Array.from(domains);
}

function extractBrandPosition(text: string, brandVariants: string[]): number | null {
  // Look for numbered lists: "1. Brand", "2. CompetitorA", etc.
  const numberedListRegex = /^\s*(\d+)[.)]\s+(.+)$/gm;
  const items: { num: number; text: string }[] = [];
  let match;
  while ((match = numberedListRegex.exec(text)) !== null) {
    items.push({ num: parseInt(match[1]!, 10), text: match[2]!.toLowerCase() });
  }
  for (const item of items) {
    if (brandVariants.some((v) => item.text.includes(v.toLowerCase()))) {
      return item.num;
    }
  }
  return null;
}

function extractMentionContext(text: string, brandVariants: string[]): string | null {
  // Find sentence containing brand mention
  const sentences = text.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    if (brandVariants.some((v) => sentence.toLowerCase().includes(v.toLowerCase()))) {
      return sentence.trim().slice(0, 300);
    }
  }
  return null;
}

function classifySentiment(context: string | null): "positive" | "neutral" | "negative" | "not_mentioned" {
  if (!context) return "not_mentioned";
  const lower = context.toLowerCase();
  const positiveWords = ["best", "top", "leading", "prominent", "reputable", "popular", "excellent", "recommend", "trusted", "quality", "premium", "reliable"];
  const negativeWords = ["avoid", "poor", "bad", "worst", "issue", "problem", "complaint", "failure"];
  const posScore = positiveWords.filter((w) => lower.includes(w)).length;
  const negScore = negativeWords.filter((w) => lower.includes(w)).length;
  if (posScore > negScore) return "positive";
  if (negScore > posScore) return "negative";
  return "neutral";
}

/**
 * Fast, deterministic extraction — no LLM call, no network.
 * Used as the primary extraction method for Phase 1.
 * LLM-assisted extraction can be layered on top later.
 */
export function extractBrandMentions(input: ExtractionInput): ExtractionResult {
  const { responseText, brandDomain, brandName, competitors = [] } = input;
  const text = responseText ?? "";
  const brandVariants = buildDomainVariants(brandDomain, brandName);

  // Brand mention check
  const brandMentioned = brandVariants.some((v) =>
    text.toLowerCase().includes(v.toLowerCase()),
  );

  // Citation check — brand domain appears in a URL
  const urlPattern = new RegExp(
    brandDomain.replace(".", "\\.").replace(/^www\./, "(www\\.)?"),
    "i",
  );
  const citationFound = urlPattern.test(text);

  // Find citation URL
  const urlRegex = /https?:\/\/[^\s)\]"]+/g;
  let citationUrl: string | null = null;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (urlPattern.test(match[0])) {
      citationUrl = match[0].trim().replace(/[.,;]$/, "");
      break;
    }
  }

  const citationDomain = citationUrl
    ? new URL(citationUrl).hostname.replace(/^www\./, "")
    : null;

  // Source domains
  const sourceDomains = extractSourceDomains(text);

  // Position in list
  const brandPosition = brandMentioned
    ? extractBrandPosition(text, brandVariants)
    : null;

  // Context sentence
  const mentionContext = brandMentioned
    ? extractMentionContext(text, brandVariants)
    : null;

  // Competitors mentioned
  const competitorsMentioned: string[] = [];
  for (const comp of competitors) {
    const compVariants = buildDomainVariants(comp, comp);
    if (compVariants.some((v) => text.toLowerCase().includes(v.toLowerCase()))) {
      competitorsMentioned.push(comp);
    }
  }

  // Sentiment
  const sentiment = brandMentioned
    ? classifySentiment(mentionContext)
    : "not_mentioned";

  return {
    brandMentioned,
    brandPosition,
    citationFound,
    citationUrl,
    citationDomain,
    competitorsMentioned,
    sourceDomains,
    mentionContext,
    sentiment,
    confidence: 0.85, // deterministic rule-based extraction
  };
}
