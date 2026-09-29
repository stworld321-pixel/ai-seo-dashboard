/**
 * Broken-link intelligence module.
 *
 * Crawls a sample of URLs from the site's PageRecord table and checks whether
 * they respond with 4xx / 5xx. Also checks for common redirect chains.
 *
 * Scoring:
 *   broken (4xx)    → –20 per page, severity HIGH
 *   server error (5xx) → –15 per page, severity HIGH
 *   redirect chain (>1 hop) → –5 per page, severity MEDIUM
 *   slow redirect (>1 hop + >500ms) → –8 per page, severity MEDIUM
 *
 * Score is clamped to [0, 100].
 */

import http from "node:http";
import https from "node:https";
import type { DetectedSeoIssue } from "./health-score";

export type LinkCheckResult = {
  url: string;
  status: number | null;
  redirectedTo?: string;
  redirectHops: number;
  latencyMs: number;
  error?: string;
};

export type BrokenLinkAuditResult = {
  score: number;
  issues: DetectedSeoIssue[];
  checked: number;
  broken: number;
  redirected: number;
};

/**
 * Check a single URL with TLS resilience and Chrome user agent using GET.
 * Follows redirects up to 5 hops and records status and hops.
 */
export async function checkUrl(url: string, timeoutMs = 10_000): Promise<LinkCheckResult> {
  const start = Date.now();
  let redirectHops = 0;
  let currentUrl = url;
  let redirectedTo: string | undefined;

  while (redirectHops <= 5) {
    try {
      const parsed = new URL(currentUrl);
      const isHttps = parsed.protocol === "https:";
      const lib = isHttps ? https : http;

      const res = await new Promise<{ status: number; location?: string }>((resolve, reject) => {
        const req = lib.request(
          parsed,
          {
            method: "GET",
            timeout: timeoutMs,
            rejectUnauthorized: false, // Prevents fetch failed on self-signed / modern TLS
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
          },
          (response) => {
            const status = response.statusCode ?? 0;
            const location = response.headers.location;
            response.resume(); // Discard body immediately
            resolve({ status, location });
          },
        );

        req.on("timeout", () => req.destroy(new Error("Request timed out")));
        req.on("error", reject);
        req.end();
      });

      if (res.status >= 300 && res.status < 400 && res.location) {
        redirectHops++;
        if (redirectHops === 1) redirectedTo = res.location;
        currentUrl = res.location.startsWith("http")
          ? res.location
          : new URL(res.location, currentUrl).toString();
      } else {
        return {
          url,
          status: res.status,
          ...(redirectedTo ? { redirectedTo } : {}),
          redirectHops,
          latencyMs: Date.now() - start,
        };
      }
    } catch (e: unknown) {
      return {
        url,
        status: null,
        redirectHops,
        latencyMs: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return {
    url,
    status: 301,
    redirectedTo: currentUrl,
    redirectHops,
    latencyMs: Date.now() - start,
  };
}

/**
 * Check multiple URLs concurrently with a concurrency limit.
 * Returns an array of LinkCheckResult in the same order as input.
 */
export async function checkUrlsBatch(
  urls: string[],
  { concurrency = 5, timeoutMs = 10_000 }: { concurrency?: number; timeoutMs?: number } = {},
): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = new Array(urls.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < urls.length) {
      const i = idx++;
      const url = urls[i]!;
      results[i] = await checkUrl(url, timeoutMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}

/**
 * Score a set of link-check results into a health-score category result.
 * Only flags genuine HTTP 404 / 4xx errors and redirect chains (no false unreachable errors).
 */
export function computeBrokenLinkAudit(results: LinkCheckResult[]): BrokenLinkAuditResult {
  if (results.length === 0) {
    return { score: 100, issues: [], checked: 0, broken: 0, redirected: 0 };
  }

  const issues: DetectedSeoIssue[] = [];
  let deductions = 0;
  let broken = 0;
  let redirected = 0;

  for (const r of results) {
    // Ignore transient network socket drops so working pages are never falsely flagged as broken
    if (r.status === null) {
      continue;
    }

    if (r.status === 404) {
      broken++;
      deductions += 20;
      issues.push({
        category: "Broken Links",
        severity: "HIGH",
        title: `404 Not Found — URL is linked or indexed but returns 404 error`,
        url: r.url,
        detail: { status: 404, latencyMs: r.latencyMs },
      });
    } else if (r.status === 410) {
      broken++;
      deductions += 15;
      issues.push({
        category: "Broken Links",
        severity: "HIGH",
        title: `410 Gone — permanently deleted page still referenced`,
        url: r.url,
        detail: { status: 410, latencyMs: r.latencyMs },
      });
    } else if (r.status >= 400 && r.status < 500) {
      broken++;
      deductions += 18;
      issues.push({
        category: "Broken Links",
        severity: "HIGH",
        title: `HTTP ${r.status} client error — URL is inaccessible`,
        url: r.url,
        detail: { status: r.status, latencyMs: r.latencyMs },
      });
    } else if (r.status >= 500) {
      deductions += 15;
      issues.push({
        category: "Broken Links",
        severity: "HIGH",
        title: `HTTP ${r.status} server error — URL returned internal error`,
        url: r.url,
        detail: { status: r.status, latencyMs: r.latencyMs },
      });
    } else if (r.redirectHops > 1) {
      redirected++;
      const penaltyExtra = r.latencyMs > 500 ? 3 : 0;
      deductions += 5 + penaltyExtra;
      issues.push({
        category: "Broken Links",
        severity: "MEDIUM",
        title: `Redirect chain (${r.redirectHops} hops) — consolidate to a single 301`,
        url: r.url,
        detail: { status: r.status, redirectHops: r.redirectHops, redirectedTo: r.redirectedTo ?? null, latencyMs: r.latencyMs },
      });
    } else if (r.redirectHops === 1) {
      redirected++;
      issues.push({
        category: "Broken Links",
        severity: "LOW",
        title: `Redirect detected (${r.status}) — update internal links directly to ${r.redirectedTo ?? "destination URL"}`,
        url: r.url,
        detail: { status: r.status, redirectHops: 1, redirectedTo: r.redirectedTo ?? null, latencyMs: r.latencyMs },
      });
    }
  }

  const score = Math.max(0, Math.round(100 - deductions));
  return { score, issues, checked: results.length, broken, redirected };
}
