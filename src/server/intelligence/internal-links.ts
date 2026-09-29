import type { Opportunity, PageMetrics, QueryMetrics } from "@/lib/types";

/**
 * Deterministic Internal Link Suggestion Engine (docs/06 §H. INTERNAL_LINK).
 *
 * Computes topical similarity between source and target pages on the site,
 * weighted by the target page's opportunity score, orphan status, and relevance.
 * Works seamlessly for ANY website with or without Google Search Console / CMS logins.
 *
 * Rules:
 * - Excludes utility, legal, and career pages (privacy policy, terms, careers, cart, checkout, login, etc.)
 * - Prioritizes core SEO targets: website service pages, blogs/articles, product categories, and homepages
 * - Generates natural, keyword-rich, and contextual anchor text (NEVER generic "learn more" or "click here")
 */

export type LinkSuggestion = {
  sourceUrl: string;
  targetUrl: string;
  anchor: string;
  reason: string;
  confidence: number;
};

export type InternalLinkPageRecord = {
  url: string;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  wordCount?: number | null;
  isOrphan?: boolean | null;
  contentScoreDetail?: unknown;
};

export type InternalLinkInput = {
  pages?: PageMetrics[];
  queries?: QueryMetrics[];
  opportunities?: Opportunity[];
  pageRecords?: InternalLinkPageRecord[];
};

/**
 * Returns true if a URL represents a non-SEO utility, legal, career, or transactional page
 * that should NOT receive SEO internal link equity or be suggested as a target.
 */
export function isUtilityOrLegalPage(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    const p = parsed.pathname.toLowerCase().replace(/\/+$/, "");
    if (!p || p === "") return false; // Homepage is valid!

    const blockedSegments = [
      "privacy-policy",
      "privacy",
      "terms-and-conditions",
      "terms-of-service",
      "terms-of-use",
      "terms",
      "cookie-policy",
      "cookies",
      "disclaimer",
      "refund-policy",
      "shipping-policy",
      "cancellation-policy",
      "return-policy",
      "gdpr",
      "legal",
      "career",
      "careers",
      "jobs",
      "job",
      "join-our-team",
      "we-are-hiring",
      "work-with-us",
      "cart",
      "checkout",
      "my-account",
      "account",
      "login",
      "signin",
      "sign-in",
      "signup",
      "sign-up",
      "register",
      "thank-you",
      "order-received",
      "wishlist",
      "wp-admin",
      "wp-login",
      "feed",
      "tag",
      "author",
      "404",
      "search",
    ];

    const segments = p.split("/").filter(Boolean);
    return segments.some((seg) =>
      blockedSegments.some((blocked) => seg === blocked || seg.startsWith(`${blocked}-`) || seg.endsWith(`-${blocked}`)),
    );
  } catch {
    return false;
  }
}

export function extractTokens(urlOrQuery: string): string[] {
  try {
    const path = urlOrQuery.startsWith("http") ? new URL(urlOrQuery).pathname : urlOrQuery;
    return path
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter(
        (t) =>
          t.length >= 3 &&
          ![
            "page",
            "the",
            "for",
            "and",
            "with",
            "from",
            "about",
            "contact",
            "home",
            "index",
            "post",
            "html",
            "php",
            "offer",
            "we",
          ].includes(t),
      );
  } catch {
    return [];
  }
}

/**
 * Generates natural, keyword-rich, and contextual anchor text for a target page.
 * Strips brand suffixes, cleans URL slugs, and formats proper descriptive phrases.
 */
export function generateCleanAnchor(target: {
  url: string;
  title?: string | null;
  h1?: string | null;
  focusKeyword?: string | null;
  slugTokens?: string[];
}): string {
  // 1. If focus keyword exists and is descriptive
  if (target.focusKeyword && target.focusKeyword.trim().length >= 4) {
    const cleanKw = target.focusKeyword
      .replace(/[|–—:-].*$/, "")
      .replace(/\b(learn more|click here|read more|page|link|official website|home page|home)\b/gi, "")
      .trim();
    if (cleanKw.length >= 4 && !/^\d+$/.test(cleanKw)) {
      return cleanKw;
    }
  }

  // 2. Extract from H1 or Title (remove brand names, separators & site suffixes)
  const candidate = target.h1 || target.title;
  if (candidate) {
    const cleanTitle = candidate
      .split(/[|–—:-]/)[0]!
      .replace(/\b(official website|welcome to|home page|home)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanTitle.length >= 4 && cleanTitle.length <= 48) {
      return cleanTitle.toLowerCase();
    }
  }

  // 3. Derive semantic anchor from URL slug
  try {
    const pathname = new URL(target.url).pathname.replace(/^\/+|\/+$/g, "");
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    const cleanSlug = last
      .replace(/[-_]+/g, " ")
      .replace(/\.(html|php|aspx)$/i, "")
      .replace(/\b(services?|we|offer|page|custom)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanSlug.length >= 4) {
      if (cleanSlug.includes("e commerce") || cleanSlug.includes("ecommerce")) {
        return "e-commerce website development";
      }
      if (cleanSlug.includes("landing page")) {
        return "landing page development";
      }
      if (cleanSlug.includes("website design") || cleanSlug.includes("web design")) {
        return "website design & development";
      }
      if (cleanSlug.includes("seo")) {
        return "search engine optimization services";
      }
      return cleanSlug.toLowerCase();
    }
  } catch {
    // fallback
  }

  const tokens = target.slugTokens || extractTokens(target.url);
  if (tokens.length > 0) {
    return tokens.join(" ");
  }

  return "custom web solutions";
}

type MergedPage = {
  url: string;
  title: string;
  h1: string;
  focusKeyword: string;
  impressions: number;
  position: number;
  isOrphan: boolean;
  wordCount: number;
  isServiceOrBlog: boolean;
};

export function generateInternalLinkSuggestions(input: InternalLinkInput): LinkSuggestion[] {
  const pageMap = new Map<string, MergedPage>();

  // 1. Ingest PageRecords from live website crawler
  if (input.pageRecords && input.pageRecords.length > 0) {
    for (const r of input.pageRecords) {
      if (!r.url || r.url.includes("?") || isUtilityOrLegalPage(r.url)) continue;
      const detail = (r.contentScoreDetail ?? {}) as {
        focusKeyword?: string;
        incomingLinks?: number;
      };
      const pathTokens = extractTokens(r.url);
      const isServiceOrBlog =
        r.url.includes("/service") ||
        r.url.includes("/services-we-offer") ||
        r.url.includes("/solution") ||
        r.url.includes("/blog") ||
        r.url.includes("/article") ||
        r.url.includes("/product") ||
        r.url.includes("/category");

      const focusKeyword = generateCleanAnchor({
        url: r.url,
        title: r.title,
        h1: r.h1,
        focusKeyword: detail.focusKeyword,
        slugTokens: pathTokens,
      });

      pageMap.set(r.url, {
        url: r.url,
        title: r.title || r.url,
        h1: r.h1 || r.title || r.url,
        focusKeyword,
        impressions: 0,
        position: 25,
        isOrphan: Boolean(r.isOrphan || detail.incomingLinks === 0),
        wordCount: r.wordCount ?? 400,
        isServiceOrBlog,
      });
    }
  }

  // 2. Ingest GSC PageMetrics if available
  if (input.pages && input.pages.length > 0) {
    for (const p of input.pages) {
      if (!p.page || p.page.includes("?") || isUtilityOrLegalPage(p.page)) continue;
      const existing = pageMap.get(p.page);
      if (existing) {
        existing.impressions = p.impressions;
        existing.position = p.position;
      } else {
        const pathTokens = extractTokens(p.page);
        const isServiceOrBlog =
          p.page.includes("/service") ||
          p.page.includes("/services-we-offer") ||
          p.page.includes("/solution") ||
          p.page.includes("/blog") ||
          p.page.includes("/article") ||
          p.page.includes("/product") ||
          p.page.includes("/category");

        const focusKeyword = generateCleanAnchor({
          url: p.page,
          slugTokens: pathTokens,
        });

        pageMap.set(p.page, {
          url: p.page,
          title: p.page,
          h1: p.page,
          focusKeyword,
          impressions: p.impressions,
          position: p.position,
          isOrphan: false,
          wordCount: 500,
          isServiceOrBlog,
        });
      }
    }
  }

  const allPages = Array.from(pageMap.values());
  if (allPages.length < 2) return [];

  const oppByUrl = new Map<string, Opportunity>();
  if (input.opportunities) {
    for (const o of input.opportunities) {
      if (o.targetUrl && !oppByUrl.has(o.targetUrl) && !isUtilityOrLegalPage(o.targetUrl)) {
        oppByUrl.set(o.targetUrl, o);
      }
    }
  }

  // 3. Select High-Value SEO Targets:
  // - Services, Solutions, Products, Blogs, and Guides
  // - Opportunity pages identified by the system
  // - Orphan pages needing internal link equity
  const targets = allPages
    .filter(
      (p) =>
        !isUtilityOrLegalPage(p.url) &&
        (p.isServiceOrBlog || oppByUrl.has(p.url) || p.isOrphan || p.impressions >= 10),
    )
    .sort((a, b) => {
      // Prioritize service & blog pages with opportunities or orphan status
      if (a.isOrphan && !b.isOrphan) return -1;
      if (!a.isOrphan && b.isOrphan) return 1;
      if (a.isServiceOrBlog && !b.isServiceOrBlog) return -1;
      if (!a.isServiceOrBlog && b.isServiceOrBlog) return 1;
      return b.impressions - a.impressions;
    });

  const effectiveTargets = targets.length > 0 ? targets : allPages.slice(0, 12);
  const suggestions: LinkSuggestion[] = [];
  const seenPairs = new Set<string>();

  for (const target of effectiveTargets) {
    const opp = oppByUrl.get(target.url);
    const targetTokens = extractTokens(target.url);

    // Pick top-ranking keyword query if available in GSC, or descriptive target focus keyword
    const gscQuery = input.queries?.find((q) => q.page === target.url && q.query.length >= 4)?.query;
    const cleanAnchor = gscQuery || target.focusKeyword || generateCleanAnchor(target);

    if (!cleanAnchor || cleanAnchor.length < 3 || cleanAnchor.toLowerCase() === "learn more") continue;

    for (const source of allPages) {
      if (source.url === target.url || isUtilityOrLegalPage(source.url)) continue;
      const pairKey = `${source.url}->${target.url}`;
      if (seenPairs.has(pairKey)) continue;

      const sourceTokens = extractTokens(source.url);
      const shared = targetTokens.filter((t) => sourceTokens.includes(t));
      const isHubSource =
        source.url.endsWith("/") &&
        (source.url.split("/").length <= 4 ||
          source.url.includes("/services") ||
          source.url.includes("/services-we-offer") ||
          source.url.includes("/solutions") ||
          source.url.includes("/blog") ||
          source.url.includes("/shop") ||
          source.url.includes("/category"));

      // Connect if there is topical keyword overlap OR if source is a service hub/homepage
      if (shared.length === 0 && !isHubSource && !target.isOrphan && !source.isServiceOrBlog) continue;

      const similarity = shared.length > 0 ? Math.min(0.92, 0.62 + shared.length * 0.14) : 0.68;
      const orphanBoost = target.isOrphan ? 0.12 : 0;
      const oppBoost = opp ? 0.08 : 0;
      const confidence = Number(Math.min(0.96, similarity + orphanBoost + oppBoost).toFixed(2));

      let reason = "";
      if (target.isOrphan) {
        reason = `Resolves orphan page status by passing contextual link equity from ${shared.length > 0 ? `topically related "${shared.join(", ")}" section` : "main services catalog"} to boost Google discoverability.`;
      } else if (opp) {
        reason = `Boosts P${opp.priority} target rankings for "${cleanAnchor}" with relevant in-content link equity from ${source.title.slice(0, 45)}.`;
      } else {
        reason = `Contextual internal link passing topical authority from "${source.title.slice(0, 45)}" for target service "${cleanAnchor}".`;
      }

      seenPairs.add(pairKey);
      suggestions.push({
        sourceUrl: source.url,
        targetUrl: target.url,
        anchor: cleanAnchor,
        reason,
        confidence,
      });

      if (suggestions.length >= 30) break;
    }
    if (suggestions.length >= 30) break;
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 25);
}
