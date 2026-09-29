/**
 * Page Speed intelligence module.
 *
 * Converts raw PSI/CrUX field data (stored in PageRecord.contentScoreDetail)
 * or live Google PageSpeed Insights API responses into scored issues that feed
 * into the health-score category "Page Speed".
 *
 * Thresholds are exactly the Google Core Web Vitals 2024 boundaries:
 *   LCP  good < 2.5s  / needs-improvement < 4.0s / poor ≥ 4.0s
 *   INP  good < 200ms / needs-improvement < 500ms / poor ≥ 500ms
 *   CLS  good < 0.1   / needs-improvement < 0.25  / poor ≥ 0.25
 *   TTFB good < 0.8s  / needs-improvement < 1.8s  / poor ≥ 1.8s
 *   FCP  good < 1.8s  / needs-improvement < 3.0s  / poor ≥ 3.0s
 *   PSI  score (0-100): good ≥ 90 / needs-improvement ≥ 50 / poor < 50
 *
 * Score formula (per page, then averaged):
 *   100 – Σ deductions where each metric ∈ {good=0, needs-improvement, poor}
 */

import type { DetectedSeoIssue } from "./health-score";

/** Raw field data for one page (sourced from PSI API or contentScoreDetail). */
export type PageSpeedData = {
  url: string;
  /** PSI performance score 0–100, null if not available */
  performanceScore: number | null;
  /** Largest Contentful Paint in seconds */
  lcp: number | null;
  /** Interaction to Next Paint in milliseconds */
  inp: number | null;
  /** Cumulative Layout Shift (unitless) */
  cls: number | null;
  /** Time to First Byte in seconds */
  ttfb: number | null;
  /** First Contentful Paint in seconds */
  fcp: number | null;
  /** Mobile or desktop */
  strategy: "mobile" | "desktop";
};

export type PageSpeedAuditResult = {
  score: number;
  issues: DetectedSeoIssue[];
  pagesChecked: number;
  pagesWithPoorCWV: number;
};

type MetricRating = "good" | "needs-improvement" | "poor";

function rateLCP(s: number | null): MetricRating {
  if (s === null) return "good";
  if (s < 2.5) return "good";
  if (s < 4.0) return "needs-improvement";
  return "poor";
}
function rateINP(ms: number | null): MetricRating {
  if (ms === null) return "good";
  if (ms < 200) return "good";
  if (ms < 500) return "needs-improvement";
  return "poor";
}
function rateCLS(v: number | null): MetricRating {
  if (v === null) return "good";
  if (v < 0.1) return "good";
  if (v < 0.25) return "needs-improvement";
  return "poor";
}
function rateTTFB(s: number | null): MetricRating {
  if (s === null) return "good";
  if (s < 0.8) return "good";
  if (s < 1.8) return "needs-improvement";
  return "poor";
}
function rateFCP(s: number | null): MetricRating {
  if (s === null) return "good";
  if (s < 1.8) return "good";
  if (s < 3.0) return "needs-improvement";
  return "poor";
}
function rateScore(score: number | null): MetricRating {
  if (score === null) return "good";
  if (score >= 90) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
}

/**
 * Deductions per metric rating (applied per page, then averaged across site).
 * Values tuned so a single poor-LCP page on a 20-page site yields ~5 pts off.
 */
const DEDUCTIONS: Record<string, { "needs-improvement": number; poor: number }> = {
  lcp: { "needs-improvement": 12, poor: 25 },
  inp: { "needs-improvement": 8, poor: 20 },
  cls: { "needs-improvement": 8, poor: 20 },
  ttfb: { "needs-improvement": 5, poor: 12 },
  fcp: { "needs-improvement": 5, poor: 12 },
  score: { "needs-improvement": 10, poor: 22 },
};

function deduct(rating: MetricRating, metric: string): number {
  if (rating === "good") return 0;
  return DEDUCTIONS[metric]?.[rating] ?? 0;
}

export function computePageSpeedAudit(pages: PageSpeedData[]): PageSpeedAuditResult {
  if (pages.length === 0) {
    return { score: 100, issues: [], pagesChecked: 0, pagesWithPoorCWV: 0 };
  }

  const issues: DetectedSeoIssue[] = [];
  let totalDeductions = 0;
  let pagesWithPoorCWV = 0;

  for (const p of pages) {
    const rLCP = rateLCP(p.lcp);
    const rINP = rateINP(p.inp);
    const rCLS = rateCLS(p.cls);
    const rTTFB = rateTTFB(p.ttfb);
    const rFCP = rateFCP(p.fcp);
    const rScore = rateScore(p.performanceScore);

    const pageDeductions =
      deduct(rLCP, "lcp") +
      deduct(rINP, "inp") +
      deduct(rCLS, "cls") +
      deduct(rTTFB, "ttfb") +
      deduct(rFCP, "fcp") +
      deduct(rScore, "score");

    totalDeductions += pageDeductions;
    if (pageDeductions > 0) pagesWithPoorCWV++;

    // Emit issues for non-good metrics
    if (rScore === "poor" || rScore === "needs-improvement") {
      issues.push({
        category: "Page Speed",
        severity: rScore === "poor" ? "HIGH" : "MEDIUM",
        title: `PSI performance score ${p.performanceScore ?? "?"}${p.strategy === "mobile" ? " (mobile)" : " (desktop)"} — ${rScore}`,
        url: p.url,
        detail: {
          performanceScore: p.performanceScore,
          strategy: p.strategy,
          lcp: p.lcp,
          inp: p.inp,
          cls: p.cls,
        },
      });
    }
    if (rLCP !== "good") {
      issues.push({
        category: "Page Speed",
        severity: rLCP === "poor" ? "HIGH" : "MEDIUM",
        title: `LCP ${p.lcp !== null ? p.lcp.toFixed(2) + "s" : "unknown"} — ${rLCP} (threshold: good < 2.5s)`,
        url: p.url,
        detail: { metric: "LCP", value: p.lcp, unit: "seconds", rating: rLCP, goodThreshold: 2.5, poorThreshold: 4.0, strategy: p.strategy },
      });
    }
    if (rINP !== "good") {
      issues.push({
        category: "Page Speed",
        severity: rINP === "poor" ? "HIGH" : "MEDIUM",
        title: `INP ${p.inp !== null ? p.inp + "ms" : "unknown"} — ${rINP} (threshold: good < 200ms)`,
        url: p.url,
        detail: { metric: "INP", value: p.inp, unit: "ms", rating: rINP, goodThreshold: 200, poorThreshold: 500, strategy: p.strategy },
      });
    }
    if (rCLS !== "good") {
      issues.push({
        category: "Page Speed",
        severity: rCLS === "poor" ? "HIGH" : "MEDIUM",
        title: `CLS ${p.cls !== null ? p.cls.toFixed(3) : "unknown"} — ${rCLS} (threshold: good < 0.1)`,
        url: p.url,
        detail: { metric: "CLS", value: p.cls, unit: "score", rating: rCLS, goodThreshold: 0.1, poorThreshold: 0.25, strategy: p.strategy },
      });
    }
    if (rTTFB !== "good") {
      issues.push({
        category: "Page Speed",
        severity: rTTFB === "poor" ? "MEDIUM" : "LOW",
        title: `TTFB ${p.ttfb !== null ? p.ttfb.toFixed(2) + "s" : "unknown"} — ${rTTFB} (threshold: good < 0.8s)`,
        url: p.url,
        detail: { metric: "TTFB", value: p.ttfb, unit: "seconds", rating: rTTFB, goodThreshold: 0.8, poorThreshold: 1.8, strategy: p.strategy },
      });
    }
    if (rFCP !== "good") {
      issues.push({
        category: "Page Speed",
        severity: rFCP === "poor" ? "MEDIUM" : "LOW",
        title: `FCP ${p.fcp !== null ? p.fcp.toFixed(2) + "s" : "unknown"} — ${rFCP} (threshold: good < 1.8s)`,
        url: p.url,
        detail: { metric: "FCP", value: p.fcp, unit: "seconds", rating: rFCP, goodThreshold: 1.8, poorThreshold: 3.0, strategy: p.strategy },
      });
    }
  }

  // Average deductions across pages, clamp score to [0, 100]
  const avgDeductions = totalDeductions / pages.length;
  const score = Math.max(0, Math.round(100 - avgDeductions));

  return { score, issues, pagesChecked: pages.length, pagesWithPoorCWV };
}

// ─── Google PageSpeed Insights API integration ────────────────────────────────

export type PSILighthouseAudit = {
  score: number | null;
  numericValue?: number | null;
};

export type PSIResponse = {
  lighthouseResult?: {
    categories?: {
      performance?: { score: number | null };
    };
    audits?: {
      "largest-contentful-paint"?: PSILighthouseAudit;
      "interaction-to-next-paint"?: PSILighthouseAudit;
      "cumulative-layout-shift"?: PSILighthouseAudit;
      "server-response-time"?: PSILighthouseAudit;
      "first-contentful-paint"?: PSILighthouseAudit;
    };
  };
  error?: { code: number; message: string };
};

/**
 * Fetch live PageSpeed Insights data for one URL.
 * Requires GOOGLE_PSI_API_KEY in environment.
 * Returns null on API error or missing key.
 *
 * PSI typically takes 15–45 seconds. Timeout is 65s with 1 retry.
 */
export async function fetchPSI(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
  apiKey?: string,
): Promise<PageSpeedData | null> {
  const key = apiKey ?? process.env.GOOGLE_PSI_API_KEY?.trim();
  if (!key) return null;

  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy.toUpperCase());
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("category", "PERFORMANCE");

  // PSI can take 20–45s. We try twice before giving up.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(endpoint.toString(), {
        headers: { Accept: "application/json" },
        // 65s timeout — PSI is slow but never more than ~60s
        signal: AbortSignal.timeout(65_000),
        // Disable Next.js cache so we always get a fresh PSI run
        cache: "no-store",
      });

      if (!res.ok) {
        // On 429 (quota) or 5xx, don't retry immediately
        if (res.status === 429 || res.status >= 500) return null;
        // On 4xx (bad URL, etc.) return null without retry
        return null;
      }

      const data = (await res.json()) as PSIResponse;
      if (data.error) return null;
      const lr = data.lighthouseResult;
      if (!lr) return null;

      const audits = lr.audits ?? {};
      const perfScore = lr.categories?.performance?.score ?? null;

      return {
        url,
        performanceScore: perfScore !== null ? Math.round(perfScore * 100) : null,
        // PSI returns numericValue in ms for LCP and FCP — convert to seconds
        lcp: audits["largest-contentful-paint"]?.numericValue != null
          ? Number((audits["largest-contentful-paint"].numericValue! / 1000).toFixed(3))
          : null,
        // INP is already in ms
        inp: audits["interaction-to-next-paint"]?.numericValue != null
          ? Math.round(audits["interaction-to-next-paint"].numericValue!)
          : null,
        // CLS is a raw decimal
        cls: audits["cumulative-layout-shift"]?.numericValue != null
          ? Number(audits["cumulative-layout-shift"].numericValue!.toFixed(4))
          : null,
        // TTFB is in ms — convert to seconds
        ttfb: audits["server-response-time"]?.numericValue != null
          ? Number((audits["server-response-time"].numericValue! / 1000).toFixed(3))
          : null,
        // FCP is in ms — convert to seconds
        fcp: audits["first-contentful-paint"]?.numericValue != null
          ? Number((audits["first-contentful-paint"].numericValue! / 1000).toFixed(3))
          : null,
        strategy,
      };
    } catch (e) {
      // On timeout or network error, retry once
      if (attempt === 2) return null;
      // Wait 2s before retry
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return null;
}
