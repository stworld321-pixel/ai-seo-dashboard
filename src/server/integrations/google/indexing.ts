/**
 * Google indexing: read real index coverage per URL, then ask Google to (re)crawl.
 *
 * Reads:  POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect
 *         (scope: webmasters.readonly — already granted)
 * Writes: POST https://indexing.googleapis.com/v3/urlNotifications:publish
 *         (scope: indexing — requires the connected account to be a PROPERTY OWNER
 *          in Search Console; older connections must re-authenticate)
 */

import { prisma } from "@/server/db";
import { getValidGoogleAccessToken } from "./oauth";
import { resolveGscProperty } from "./gsc";

export type IndexStatus = {
  url: string;
  /** PASS | PARTIAL | FAIL | NEUTRAL, or null when the lookup itself failed */
  verdict: string | null;
  coverageState: string | null;
  robotsTxtState: string | null;
  lastCrawlTime: string | null;
  indexed: boolean;
  /** Plain reason this URL is not in the index, or null when it is. */
  issue: string | null;
  source: "gsc" | "crawl" | "both";
};

type IndexStatusResult = {
  verdict?: string;
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  pageFetchState?: string;
  lastCrawlTime?: string;
};

/**
 * Turns a URL Inspection indexStatusResult into an indexed flag plus one plain
 * reason. Pure, so it can be tested without hitting Google.
 */
export function classifyIndexStatus(r: IndexStatusResult | undefined): {
  indexed: boolean;
  issue: string | null;
} {
  if (!r) return { indexed: false, issue: "Google has no record of this URL yet." };

  const coverage = r.coverageState ?? "";
  const indexed =
    r.verdict === "PASS" && /indexed/i.test(coverage) && !/not indexed/i.test(coverage);

  if (indexed) return { indexed: true, issue: null };

  if (r.robotsTxtState === "DISALLOWED") {
    return { indexed: false, issue: "Blocked by robots.txt — allow the path before requesting indexing." };
  }
  if (r.indexingState === "BLOCKED_BY_META_TAG") {
    return { indexed: false, issue: "Page has a noindex meta tag — remove it first." };
  }
  if (r.indexingState === "BLOCKED_BY_HTTP_HEADER") {
    return { indexed: false, issue: "Page sends an X-Robots-Tag: noindex header — remove it first." };
  }
  if (r.pageFetchState && r.pageFetchState !== "SUCCESSFUL") {
    return { indexed: false, issue: `Google could not fetch the page (${r.pageFetchState}).` };
  }
  return { indexed: false, issue: coverage || "Discovered but not indexed." };
}

export type IndexCandidate = {
  url: string;
  source: IndexStatus["source"];
  hasPageIssue: boolean;
  indexState: string | null;
};

/**
 * Candidate URLs for indexing: everything Search Console reports plus everything
 * we have crawled. URLs Search Console has never reported come first, then pages
 * with known on-page issues — those are the most likely to be unindexed.
 */
export async function collectIndexCandidates(websiteId: string, limit = 50): Promise<IndexCandidate[]> {
  const [pages, gscPages] = await Promise.all([
    prisma.pageRecord.findMany({
      where: { websiteId },
      select: { url: true, status: true, indexState: true },
    }),
    prisma.gscPageDaily.findMany({
      where: { websiteId },
      distinct: ["page"],
      select: { page: true },
      orderBy: { date: "desc" },
      take: 500,
    }),
  ]);

  const gscUrls = new Set(gscPages.map((p) => p.page));
  const merged = new Map<string, IndexCandidate>();

  for (const p of pages) {
    merged.set(p.url, {
      url: p.url,
      source: gscUrls.has(p.url) ? "both" : "crawl",
      hasPageIssue: p.status !== "HEALTHY",
      indexState: p.indexState,
    });
  }
  for (const url of gscUrls) {
    if (!merged.has(url)) {
      merged.set(url, { url, source: "gsc", hasPageIssue: false, indexState: null });
    }
  }

  const rank = (c: IndexCandidate) => (c.source === "crawl" ? 0 : c.hasPageIssue ? 1 : 2);

  return [...merged.values()]
    .sort((a, b) => rank(a) - rank(b) || a.url.localeCompare(b.url))
    .slice(0, limit);
}

/** Inspects URLs against the website's Search Console property. Max 20 per call (API quota). */
export async function inspectIndexStatus(
  websiteId: string,
  urls: string[],
): Promise<{ results: IndexStatus[]; error?: string }> {
  const accessToken = await getValidGoogleAccessToken(websiteId);
  if (!accessToken) {
    return { results: [], error: "Google Search Console is not connected. Connect it under Integrations." };
  }

  const siteUrl = await resolveGscProperty(websiteId, accessToken);
  if (!siteUrl) {
    return { results: [], error: "No verified Search Console property found for this website." };
  }

  const sources = new Map((await collectIndexCandidates(websiteId, 500)).map((c) => [c.url, c.source]));

  const results = await Promise.all(
    urls.slice(0, 20).map(async (url): Promise<IndexStatus> => {
      const source = sources.get(url) ?? "crawl";
      const failed = (issue: string): IndexStatus => ({
        url,
        verdict: null,
        coverageState: null,
        robotsTxtState: null,
        lastCrawlTime: null,
        indexed: false,
        issue,
        source,
      });

      try {
        const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: "en-US" }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          return failed(
            res.status === 429
              ? "URL Inspection quota exhausted (2,000/day). Try again later."
              : `Inspection failed (HTTP ${res.status}).`,
          );
        }

        const json = (await res.json()) as {
          inspectionResult?: { indexStatusResult?: IndexStatusResult };
        };
        const r = json.inspectionResult?.indexStatusResult;
        const { indexed, issue } = classifyIndexStatus(r);

        return {
          url,
          verdict: r?.verdict ?? null,
          coverageState: r?.coverageState ?? null,
          robotsTxtState: r?.robotsTxtState ?? null,
          lastCrawlTime: r?.lastCrawlTime ?? null,
          indexed,
          issue,
          source,
        };
      } catch (err) {
        return failed(err instanceof Error ? err.message : "Inspection failed.");
      }
    }),
  );

  // Cache coverage on the page record so the dashboard can show it without
  // re-inspecting. computeHealthScore() scores indexation on indexState === "PASS",
  // so keep that exact token for indexed pages and store the real reason otherwise —
  // it reads correctly in the issue title the health score generates from it.
  await Promise.all(
    results
      .filter((r) => r.verdict)
      .map((r) =>
        prisma.pageRecord.updateMany({
          where: { websiteId, url: r.url },
          data: { indexState: r.indexed ? "PASS" : (r.coverageState || "NOT_INDEXED") },
        }),
      ),
  );

  return { results };
}

export type IndexSubmission = { url: string; ok: boolean; error?: string };

/** Asks Google to crawl URLs via the Indexing API. Max 100 per call; daily quota is 200. */
export async function requestIndexing(
  websiteId: string,
  urls: string[],
): Promise<{ results: IndexSubmission[]; error?: string }> {
  const accessToken = await getValidGoogleAccessToken(websiteId);
  if (!accessToken) {
    return { results: [], error: "Google is not connected. Connect it under Integrations." };
  }

  const [googleConn, selectedGsc] = await Promise.all([
    prisma.googleConnection.findFirst({
      where: { websiteId, status: "connected" },
      select: { email: true },
    }),
    prisma.gscProperty.findFirst({
      where: { websiteId, isSelected: true },
      select: { propertyUrl: true, permissionLevel: true },
    }),
  ]);

  const results = await Promise.all(
    urls.slice(0, 100).map(async (url): Promise<IndexSubmission> => {
      try {
        const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url, type: "URL_UPDATED" }),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) return { url, ok: true };

        const rawText = await res.text();
        let errJson: {
          error?: {
            code?: number;
            message?: string;
            status?: string;
            details?: Array<{
              reason?: string;
              metadata?: { activationUrl?: string; consumer?: string };
            }>;
          };
        } | null = null;

        try {
          errJson = JSON.parse(rawText);
        } catch {
          // not JSON
        }

        const rawMsg = errJson?.error?.message || "";
        const serviceDisabled =
          errJson?.error?.details?.some((d) => d.reason === "SERVICE_DISABLED") ||
          rawMsg.includes("disabled") ||
          rawMsg.includes("has not been used in project");

        if (serviceDisabled) {
          const activationUrl =
            errJson?.error?.details?.[0]?.metadata?.activationUrl ||
            "https://console.developers.google.com/apis/api/indexing.googleapis.com/overview?project=733221266774";
          return {
            url,
            ok: false,
            error: `Web Search Indexing API is disabled in Google Cloud Project 733221266774. Please enable it at: ${activationUrl}`,
          };
        }

        if (res.status === 403) {
          if (
            selectedGsc?.permissionLevel &&
            selectedGsc.permissionLevel !== "siteOwner"
          ) {
            const roleName =
              selectedGsc.permissionLevel === "siteFullUser"
                ? "Full User"
                : selectedGsc.permissionLevel === "siteRestrictedUser"
                  ? "Restricted User"
                  : selectedGsc.permissionLevel;
            return {
              url,
              ok: false,
              error: `Permission denied: Google account ${googleConn?.email ? `(${googleConn.email}) ` : ""}is a "${roleName}" on ${selectedGsc.propertyUrl || "this site"} in Search Console. Google Indexing API strictly requires verified "Owner" permissions. In Search Console Settings → Users and permissions, grant Owner access.`,
            };
          }

          return {
            url,
            ok: false,
            error:
              rawMsg ||
              "Permission denied. The connected Google account must be a verified OWNER of this property in Google Search Console and granted the Indexing scope.",
          };
        }

        if (res.status === 429) {
          return { url, ok: false, error: "Daily Indexing API quota exhausted (200 URLs/day). Try again tomorrow." };
        }

        return { url, ok: false, error: rawMsg || `HTTP ${res.status}: ${rawText.slice(0, 200)}` };
      } catch (err) {
        return { url, ok: false, error: err instanceof Error ? err.message : "Submission failed." };
      }
    }),
  );

  return { results };
}
