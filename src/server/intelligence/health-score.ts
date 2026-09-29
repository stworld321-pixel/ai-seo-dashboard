import type { Opportunity, PageMetrics, QueryMetrics } from "@/lib/types";
import { clamp } from "./stats";
import { computePageSpeedAudit, type PageSpeedData } from "./page-speed";
import { computeBrokenLinkAudit, type LinkCheckResult } from "./broken-links";

/**
 * Deterministic SEO Health Score (docs/06 §SEO Health Score).
 *
 * Rule: "No meaningless score."
 * - Every point deducted links to concrete, countable issues.
 * - Categories without data are excluded and weights renormalized — never
 *   silently scored as 100 or 0.
 */

export type DetectedSeoIssue = {
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  url: string | null;
  detail: Record<string, string | number | boolean | null>;
};

export type CategoryBreakdown = {
  category: string;
  weight: number;
  normalizedWeight: number;
  score: number | null; // null when excluded due to no data
  included: boolean;
  reason?: string;
  issueCount: number;
};

export type HealthScoreResult = {
  total: number;
  breakdown: CategoryBreakdown[];
  issues: DetectedSeoIssue[];
};

function formatUrlPath(url: string | null | undefined): string {
  if (!url) return "page";
  try {
    const p = new URL(url).pathname;
    return p === "/" ? "homepage (/)" : p;
  } catch {
    return url;
  }
}

export type PageAuditRecord = {
  url: string;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  wordCount?: number | null;
  indexState?: string | null;
  canonical?: string | null;
  isOrphan?: boolean;
  contentScoreDetail?: unknown;
  /** When null, the page was never live-crawled — skip meta/title checks */
  lastCrawledAt?: Date | null;
};

export function computeHealthScore(input: {
  queries: QueryMetrics[];
  pages: PageMetrics[];
  opportunities: Opportunity[];
  pageRecords?: PageAuditRecord[];
  hasSchemaData?: boolean;
  hasAeoData?: boolean;
  hasBacklinkData?: boolean;
  isLocalBusiness?: boolean;
  /** Pre-fetched PageSpeed Insights data. When provided, activates the "Page Speed" category. */
  pageSpeedData?: PageSpeedData[];
  /** Pre-checked link results. When provided, activates the "Broken Links" category. */
  brokenLinkResults?: LinkCheckResult[];
}): HealthScoreResult {
  const issues: DetectedSeoIssue[] = [];
  const records = input.pageRecords ?? [];
  const recordByUrl = new Map(records.map((r) => [r.url, r]));

  // 1. Keywords (weight 12): share of impressions in pos <= 10 vs 11-20 vs >20
  const totalImp = input.queries.reduce((s, q) => s + q.impressions, 0);
  let keywordScore: number | null = null;
  let kwIssues = 0;
  if (totalImp > 0) {
    const impTop10 = input.queries
      .filter((q) => q.position <= 10.5)
      .reduce((s, q) => s + q.impressions, 0);
    const impPage2 = input.queries
      .filter((q) => q.position > 10.5 && q.position <= 20.5)
      .reduce((s, q) => s + q.impressions, 0);
    const impDeep = totalImp - impTop10 - impPage2;

    const shareTop10 = impTop10 / totalImp;
    const sharePage2 = impPage2 / totalImp;
    keywordScore = Math.round(clamp((shareTop10 * 100) + (sharePage2 * 60) + ((1 - shareTop10 - sharePage2) * 25), 10, 100));

    const deepQueries = input.queries.filter((q) => q.position > 20.5 && q.impressions >= 15);
    for (const dq of deepQueries.slice(0, 8)) {
      kwIssues++;
      issues.push({
        category: "Keywords",
        severity: dq.impressions >= 35 ? "HIGH" : "MEDIUM",
        title: `"${dq.query}" ranks deep at position ${dq.position.toFixed(1)} (${dq.impressions} impressions)`,
        url: dq.page ?? null,
        detail: {
          query: dq.query,
          impressions: dq.impressions,
          position: Number(dq.position.toFixed(1)),
          deepImpressionSharePct: Math.round((impDeep / totalImp) * 100),
        },
      });
    }
  }

  // 2. CTR (weight 12): zero-click page-1 listings and CTR gaps
  let ctrScore: number | null = null;
  let ctrIssues = 0;
  const page1Queries = input.queries.filter((q) => q.position <= 10.5 && q.impressions >= 5);
  if (page1Queries.length > 0) {
    const zeroClickPage1 = page1Queries.filter((q) => q.clicks === 0);
    const penalty = zeroClickPage1.reduce((s, q) => s + Math.min(25, Math.round(q.impressions * 0.35)), 0);
    ctrScore = clamp(100 - penalty, 15, 100);

    for (const zq of zeroClickPage1) {
      ctrIssues++;
      issues.push({
        category: "CTR",
        severity: zq.impressions >= 20 ? "HIGH" : "MEDIUM",
        title: `Page-1 listing "${zq.query}" (pos ${zq.position.toFixed(1)}) has ${zq.impressions} impressions and 0 clicks`,
        url: zq.page ?? null,
        detail: {
          query: zq.query,
          impressions: zq.impressions,
          clicks: zq.clicks,
          position: Number(zq.position.toFixed(1)),
        },
      });
    }
  }

  // 3. Content (weight 15): missing meta descriptions, missing title/H1, thin content, page-two candidates
  let contentScore: number | null = null;
  let contentIssues = 0;
  if (input.pages.length > 0 || records.length > 0) {
    let deductions = 0;
    // Only audit pages whose HTML has actually been fetched and parsed.
    // Pages without lastCrawledAt have never had their HTML inspected, so
    // we cannot reliably judge whether they have a meta description or title.
    const crawledRecords = records.filter((r) => Boolean(r.lastCrawledAt));
    const uncrawledCount = records.length - crawledRecords.length;

    for (const r of crawledRecords) {
      const metaDesc = r.metaDescription?.trim();
      if (!metaDesc) {
        deductions += 4;
        contentIssues++;
        issues.push({
          category: "Content",
          severity: "MEDIUM",
          title: `Missing meta description on ${formatUrlPath(r.url)}`,
          url: r.url,
          detail: { title: r.title ?? null, hasMetaDescription: false, crawledAt: r.lastCrawledAt?.toISOString?.() ?? null },
        });
      } else if (metaDesc.length < 50) {
        deductions += 2;
        contentIssues++;
        issues.push({
          category: "Content",
          severity: "LOW",
          title: `Meta description too short (${metaDesc.length} chars) on ${formatUrlPath(r.url)}`,
          url: r.url,
          detail: { title: r.title ?? null, length: metaDesc.length, description: metaDesc },
        });
      } else if (metaDesc.length > 165) {
        deductions += 1;
        contentIssues++;
        issues.push({
          category: "Content",
          severity: "LOW",
          title: `Meta description too long (${metaDesc.length} chars) on ${formatUrlPath(r.url)}`,
          url: r.url,
          detail: { title: r.title ?? null, length: metaDesc.length, description: metaDesc },
        });
      }

      const title = r.title?.trim();
      if (!title) {
        deductions += 4;
        contentIssues++;
        issues.push({
          category: "Content",
          severity: "HIGH",
          title: `Missing title tag on ${formatUrlPath(r.url)}`,
          url: r.url,
          detail: { url: r.url },
        });
      } else if (title.length < 15) {
        deductions += 2;
        contentIssues++;
        issues.push({
          category: "Content",
          severity: "LOW",
          title: `Title tag too short (${title.length} chars) on ${formatUrlPath(r.url)}`,
          url: r.url,
          detail: { title, length: title.length },
        });
      } else if (title.length > 70) {
        deductions += 1;
        contentIssues++;
        issues.push({
          category: "Content",
          severity: "LOW",
          title: `Title tag too long (${title.length} chars) on ${formatUrlPath(r.url)}`,
          url: r.url,
          detail: { title, length: title.length },
        });
      }

      if (r.wordCount && r.wordCount > 0 && r.wordCount < 300) {
        deductions += 3;
        contentIssues++;
        issues.push({
          category: "Content",
          severity: "LOW",
          title: `Thin content depth (${r.wordCount} words) on ${formatUrlPath(r.url)}`,
          url: r.url,
          detail: { wordCount: r.wordCount },
        });
      }
    }

    // Flag uncrawled pages as an INFO-level notice (not a penalty)
    if (uncrawledCount > 0) {
      issues.push({
        category: "Content",
        severity: "INFO",
        title: `${uncrawledCount} page(s) not yet crawled — run "Full Technical Audit" to verify their meta descriptions and titles`,
        url: null,
        detail: { uncrawledPages: uncrawledCount },
      });
    }
    for (const o of input.opportunities) {
      if (o.type === "PAGE_TWO" || o.type === "CANNIBALIZATION" || o.type === "DECLINING_PAGE") {
        deductions += 8;
        contentIssues++;
        issues.push({
          category: "Content",
          severity: o.priority <= 2 ? "HIGH" : "MEDIUM",
          title: o.why,
          url: o.targetUrl ?? null,
          detail: { opportunityType: o.type, keyword: o.keyword ?? null, priority: o.priority },
        });
      }
    }
    contentScore = clamp(100 - deductions, 20, 100);
  }

  // 4. Technical SEO (weight 15): parameterized URLs receiving impressions, missing canonicals, uncategorized archives
  let techScore: number | null = null;
  let techIssues = 0;
  if (input.pages.length > 0) {
    let deductions = 0;
    for (const p of input.pages) {
      if (p.page.includes("?")) {
        deductions += 12;
        techIssues++;
        issues.push({
          category: "Technical SEO",
          severity: "HIGH",
          title: `Parameterized URL indexed and receiving impressions`,
          url: p.page,
          detail: { impressions: p.impressions, position: Number(p.position.toFixed(1)), queryString: true },
        });
      }
      if (p.page.includes("/category/uncategorized")) {
        deductions += 8;
        techIssues++;
        issues.push({
          category: "Technical SEO",
          severity: "MEDIUM",
          title: `Default '/category/uncategorized/' archive is indexed in Search Console`,
          url: p.page,
          detail: { impressions: p.impressions, position: Number(p.position.toFixed(1)) },
        });
      }
      const rec = recordByUrl.get(p.page);
      if (rec && !rec.canonical) {
        deductions += 5;
        techIssues++;
        issues.push({
          category: "Technical SEO",
          severity: "LOW",
          title: `Missing explicit canonical URL on ${formatUrlPath(p.page)}`,
          url: p.page,
          detail: { url: p.page },
        });
      }
    }
    techScore = clamp(100 - deductions, 25, 100);
  }

  // 5. Internal Linking (weight 10): product/content pages ranking on page 1-2 needing internal link equity
  let linkScore: number | null = null;
  let linkIssues = 0;
  if (input.pages.length > 0) {
    const underlinked = input.pages.filter(
      (p) => (p.page.includes("/product/") || p.page.includes("/service/")) && p.position > 5 && p.position <= 20.5 && p.impressions >= 15,
    );
    const orphanCount = records.filter((r) => r.isOrphan).length;
    const deductions = underlinked.length * 8 + orphanCount * 12;
    linkScore = clamp(100 - deductions, 30, 100);

    for (const u of underlinked) {
      linkIssues++;
      issues.push({
        category: "Internal Linking",
        severity: u.impressions >= 50 ? "HIGH" : "MEDIUM",
        title: `High-impression landing page (pos ${u.position.toFixed(1)}, ${u.impressions} impr.) needs contextual internal links`,
        url: u.page,
        detail: { impressions: u.impressions, position: Number(u.position.toFixed(1)) },
      });
    }
  }

  // 6. Indexation (weight 10): based on PageRecord indexState when available
  const inspectedRecords = records.filter((r) => r.indexState);
  let indexScore: number | null = null;
  let indexIssues = 0;
  if (inspectedRecords.length > 0) {
    const passing = inspectedRecords.filter((r) => r.indexState === "PASS").length;
    indexScore = Math.round((passing / inspectedRecords.length) * 100);
    for (const r of inspectedRecords.filter((x) => x.indexState !== "PASS")) {
      indexIssues++;
      issues.push({
        category: "Indexation",
        severity: "HIGH",
        title: `Page indexation state is ${r.indexState} on ${formatUrlPath(r.url)}`,
        url: r.url,
        detail: { indexState: r.indexState ?? "UNKNOWN" },
      });
    }
  }

  // 7. Page Speed (weight 10): sourced from PageSpeed Insights API audit
  let pageSpeedScore: number | null = null;
  let pageSpeedIssues = 0;
  if (input.pageSpeedData && input.pageSpeedData.length > 0) {
    const psAudit = computePageSpeedAudit(input.pageSpeedData);
    pageSpeedScore = psAudit.score;
    pageSpeedIssues = psAudit.issues.length;
    for (const i of psAudit.issues) issues.push(i);
  }

  // 8. Broken Links (weight 8): sourced from crawl-based link checker
  let brokenLinkScore: number | null = null;
  let brokenLinkIssueCount = 0;
  if (input.brokenLinkResults && input.brokenLinkResults.length > 0) {
    const blAudit = computeBrokenLinkAudit(input.brokenLinkResults);
    brokenLinkScore = blAudit.score;
    brokenLinkIssueCount = blAudit.issues.length;
    for (const i of blAudit.issues) issues.push(i);
  }

  // 9. Schema Markup (weight 7): structured JSON-LD schema analysis across crawled pages
  let schemaScore: number | null = null;
  let schemaIssues = 0;
  if (records.length >= 2 || input.hasSchemaData) {
    const pagesWithSchema = records.filter((r) => {
      const detail = r.contentScoreDetail as { hasSchema?: boolean; schemaTypes?: string[] } | null;
      return detail?.hasSchema || (detail?.schemaTypes && detail.schemaTypes.length > 0);
    });
    const missingSchema = records.filter((r) => {
      const detail = r.contentScoreDetail as { hasSchema?: boolean; schemaTypes?: string[] } | null;
      return !detail?.hasSchema && (!detail?.schemaTypes || detail.schemaTypes.length === 0);
    });

    schemaScore = Math.round((pagesWithSchema.length / Math.max(1, records.length)) * 100);
    for (const ms of missingSchema.slice(0, 5)) {
      schemaIssues++;
      issues.push({
        category: "Schema",
        severity: "MEDIUM",
        title: `Missing JSON-LD structured schema on ${formatUrlPath(ms.url)}`,
        url: ms.url,
        detail: { title: ms.title ?? null, hasSchema: false },
      });
    }
  }

  // 10. AEO / GEO Search Readiness (weight 7): AI answer engine extractability & content readiness
  let aeoScore: number | null = null;
  let aeoIssues = 0;
  if (input.hasAeoData || records.length >= 2) {
    const thinPages = records.filter((r) => r.wordCount && r.wordCount < 300);
    const deductions = thinPages.length * 10;
    aeoScore = clamp(100 - deductions, 35, 100);
    for (const tp of thinPages.slice(0, 4)) {
      aeoIssues++;
      issues.push({
        category: "AEO/GEO",
        severity: "MEDIUM",
        title: `Content depth on ${formatUrlPath(tp.url)} is too low (${tp.wordCount} words) for AI answer engines`,
        url: tp.url,
        detail: { wordCount: tp.wordCount ?? null },
      });
    }
  }

  // Categories — weights sum to 100 when all are included.
  const rawCategories: Omit<CategoryBreakdown, "normalizedWeight">[] = [
    {
      category: "Technical SEO",
      weight: 12,
      score: techScore,
      included: techScore !== null,
      reason: techScore === null ? "No page data synced" : undefined,
      issueCount: techIssues,
    },
    {
      category: "Content",
      weight: 12,
      score: contentScore,
      included: contentScore !== null,
      reason: contentScore === null ? "No content records synced" : undefined,
      issueCount: contentIssues,
    },
    {
      category: "Keywords",
      weight: 10,
      score: keywordScore,
      included: keywordScore !== null,
      reason: keywordScore === null ? "No keyword impressions synced" : undefined,
      issueCount: kwIssues,
    },
    {
      category: "CTR",
      weight: 10,
      score: ctrScore,
      included: ctrScore !== null,
      reason: ctrScore === null ? "No page-1 queries to evaluate" : undefined,
      issueCount: ctrIssues,
    },
    {
      category: "Internal Linking",
      weight: 8,
      score: linkScore,
      included: linkScore !== null,
      reason: linkScore === null ? "No page graph synced" : undefined,
      issueCount: linkIssues,
    },
    {
      category: "Indexation",
      weight: 8,
      score: indexScore,
      included: indexScore !== null,
      reason: indexScore === null ? "URL inspection not run yet" : undefined,
      issueCount: indexIssues,
    },
    {
      category: "Page Speed",
      weight: 10,
      score: pageSpeedScore,
      included: pageSpeedScore !== null,
      reason: pageSpeedScore === null ? "Excluded — run Technical Audit to fetch PSI data" : undefined,
      issueCount: pageSpeedIssues,
    },
    {
      category: "Broken Links",
      weight: 8,
      score: brokenLinkScore,
      included: brokenLinkScore !== null,
      reason: brokenLinkScore === null ? "Excluded — run Technical Audit to crawl site links" : undefined,
      issueCount: brokenLinkIssueCount,
    },
    {
      category: "Schema",
      weight: 7,
      score: schemaScore,
      included: schemaScore !== null,
      reason: schemaScore === null ? "Excluded — on-page JSON-LD crawler not run yet" : undefined,
      issueCount: schemaIssues,
    },
    {
      category: "AEO/GEO",
      weight: 7,
      score: aeoScore,
      included: aeoScore !== null,
      reason: aeoScore === null ? "Excluded — AI answer block audit not run yet" : undefined,
      issueCount: aeoIssues,
    },
    {
      category: "Backlinks",
      weight: 4,
      score: null,
      included: false,
      reason: "Excluded — no backlink provider connected",
      issueCount: 0,
    },
    {
      category: "Local SEO",
      weight: 4,
      score: null,
      included: false,
      reason: "Excluded — e-commerce/global site (not flagged local)",
      issueCount: 0,
    },
  ];

  const includedWeightSum = rawCategories
    .filter((c) => c.included && c.score !== null)
    .reduce((s, c) => s + c.weight, 0);

  const breakdown: CategoryBreakdown[] = rawCategories.map((c) => ({
    ...c,
    normalizedWeight:
      c.included && includedWeightSum > 0
        ? Number(((c.weight / includedWeightSum) * 100).toFixed(1))
        : 0,
  }));

  const total =
    includedWeightSum > 0
      ? Math.round(
          breakdown
            .filter((c) => c.included && c.score !== null)
            .reduce((s, c) => s + (c.score! * c.weight) / includedWeightSum, 0),
        )
      : 0;

  return { total, breakdown, issues };
}
