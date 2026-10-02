/**
 * Official Google Search Console Direct API Sync Engine.
 *
 * Calls: POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
 *
 * Normalizes query, page, country, and device performance data into
 * GscDaily, GscQueryDaily, GscPageDaily, GscQueryPageDaily, and GscDimensionDaily.
 */

import { prisma } from "@/server/db";
import { getValidGoogleAccessToken, fetchGoogleSearchConsoleProperties } from "./oauth";
import { recomputeWebsiteOpportunities } from "@/server/services/dashboard";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export type GscSyncResult = {
  success: boolean;
  rowsProcessed: number;
  startDate?: string;
  endDate?: string;
  error?: string;
};

/**
 * The verified Search Console property to query for a website: an explicitly
 * selected property, else the one Google reports for this domain, else the raw
 * site URL as a last resort. Shared by the sync engine and URL Inspection.
 */
export async function resolveGscProperty(
  websiteId: string,
  accessToken: string,
): Promise<string | null> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: { gscProperties: { where: { isSelected: true } } },
  });
  if (!website) return null;

  let selected = website.gscProperties?.[0]?.propertyUrl || website.gscProperty || website.url;

  try {
    const rawUrl = website.url.startsWith("http") ? website.url : `https://${website.url}`;
    const domain = new URL(rawUrl.endsWith("/") ? rawUrl : `${rawUrl}/`).hostname
      .replace(/^www\./, "")
      .toLowerCase();

    // Auto-discover verified GSC property (e.g. sc-domain:domain or exact URL prefix)
    const allProps = await fetchGoogleSearchConsoleProperties(accessToken).catch(() => []);
    const match = allProps.find((p) => p.siteUrl.toLowerCase().includes(domain));
    if (match) selected = match.siteUrl;
  } catch {
    // Keep the fallback
  }

  return selected;
}

export async function syncDirectGoogleSearchConsole(
  websiteId: string,
  days: number = 90,
): Promise<GscSyncResult> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: {
      gscProperties: { where: { isSelected: true } },
    },
  });

  if (!website) {
    return { success: false, rowsProcessed: 0, error: "Website not found." };
  }

  const accessToken = await getValidGoogleAccessToken(websiteId);

  if (!accessToken) {
    return {
      success: false,
      rowsProcessed: 0,
      error:
        "Google Search Console is not connected or token has expired. Re-authenticate via Google OAuth.",
    };
  }

  const selectedProperty = (await resolveGscProperty(websiteId, accessToken)) ?? website.url;

  // Calculate start and end date (90 days window by default, wide enough for complete baseline)
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Math.max(days, 90));

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const encodedSiteUrl = encodeURIComponent(selectedProperty);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

  try {
    const fetchDimension = async (dimensions: string[], rowLimit: number = 5000) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          rowLimit,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GSC API HTTP ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as {
        rows?: Array<{
          keys: string[];
          clicks: number;
          impressions: number;
          ctr: number;
          position: number;
        }>;
      };
      return data.rows ?? [];
    };

    // Run parallel queries across separate dimensions:
    // 1. dimensions: ["date"] -> Exact aggregate site totals (no privacy-drop of anonymized queries)
    // 2. dimensions: ["query"] -> Search query breakdowns
    // 3. dimensions: ["page"] -> Page URL breakdowns
    // 4. dimensions: ["query", "page"] -> Query + landing page mapping
    // 5. dimensions: ["country"] & ["device"] -> Audience dimensions
    const [dateRows, queryRows, pageRows, queryPageRows, countryRows, deviceRows] =
      await Promise.all([
        fetchDimension(["date"]),
        fetchDimension(["query"]),
        fetchDimension(["page"]),
        fetchDimension(["query", "page"]),
        fetchDimension(["country"]),
        fetchDimension(["device"]),
      ]);

    if (dateRows.length === 0) {
      await prisma.website.update({
        where: { id: websiteId },
        data: {
          lastGscSyncAt: new Date(),
          gscProperty: selectedProperty,
        },
      });
      return { success: true, rowsProcessed: 0, startDate, endDate };
    }

    // Determine latest data date from the GSC date response
    let latestDateStr = dateRows[dateRows.length - 1]?.keys[0] || "2026-03-25";
    for (const r of dateRows) {
      if (r.keys[0] > latestDateStr) latestDateStr = r.keys[0];
    }
    const latestDate = new Date(`${latestDateStr}T00:00:00Z`);

    // 1. Persist 100% accurate site-level daily totals
    for (const r of dateRows) {
      const d = new Date(`${r.keys[0]}T00:00:00Z`);
      await prisma.gscDaily.upsert({
        where: { websiteId_date: { websiteId, date: d } },
        create: {
          websiteId,
          date: d,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        },
        update: {
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        },
      });
    }

    // 2. Persist query aggregates
    for (const q of queryRows) {
      const queryName = q.keys[0];
      if (!queryName) continue;
      await prisma.gscQueryDaily.upsert({
        where: { websiteId_date_query: { websiteId, date: latestDate, query: queryName } },
        create: {
          websiteId,
          date: latestDate,
          query: queryName,
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr,
          position: q.position,
        },
        update: {
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr,
          position: q.position,
        },
      });
    }

    // 3. Persist page aggregates
    for (const p of pageRows) {
      const pageUrl = p.keys[0];
      if (!pageUrl) continue;
      await prisma.gscPageDaily.upsert({
        where: { websiteId_date_page: { websiteId, date: latestDate, page: pageUrl } },
        create: {
          websiteId,
          date: latestDate,
          page: pageUrl,
          clicks: p.clicks,
          impressions: p.impressions,
          ctr: p.ctr,
          position: p.position,
        },
        update: {
          clicks: p.clicks,
          impressions: p.impressions,
          ctr: p.ctr,
          position: p.position,
        },
      });
    }

    // 4. Persist query + page mapping
    for (const qp of queryPageRows) {
      const queryName = qp.keys[0];
      const pageUrl = qp.keys[1];
      if (!queryName || !pageUrl) continue;
      await prisma.gscQueryPageDaily.upsert({
        where: {
          websiteId_date_query_page: {
            websiteId,
            date: latestDate,
            query: queryName,
            page: pageUrl,
          },
        },
        create: {
          websiteId,
          date: latestDate,
          query: queryName,
          page: pageUrl,
          clicks: qp.clicks,
          impressions: qp.impressions,
          ctr: qp.ctr,
          position: qp.position,
        },
        update: {
          clicks: qp.clicks,
          impressions: qp.impressions,
          ctr: qp.ctr,
          position: qp.position,
        },
      });
    }

    // 5. Persist country dimensions
    for (const c of countryRows) {
      const cKey = c.keys[0]?.toLowerCase();
      if (!cKey) continue;
      await prisma.gscDimensionDaily.upsert({
        where: {
          websiteId_date_dimension_value: {
            websiteId,
            date: latestDate,
            dimension: "country",
            value: cKey,
          },
        },
        create: {
          websiteId,
          date: latestDate,
          dimension: "country",
          value: cKey,
          clicks: c.clicks,
          impressions: c.impressions,
          ctr: c.ctr,
          position: c.position,
        },
        update: {
          clicks: c.clicks,
          impressions: c.impressions,
          ctr: c.ctr,
          position: c.position,
        },
      });
    }

    // 6. Persist device dimensions
    for (const d of deviceRows) {
      const dKey = d.keys[0]?.toUpperCase();
      if (!dKey) continue;
      await prisma.gscDimensionDaily.upsert({
        where: {
          websiteId_date_dimension_value: {
            websiteId,
            date: latestDate,
            dimension: "device",
            value: dKey,
          },
        },
        create: {
          websiteId,
          date: latestDate,
          dimension: "device",
          value: dKey,
          clicks: d.clicks,
          impressions: d.impressions,
          ctr: d.ctr,
          position: d.position,
        },
        update: {
          clicks: d.clicks,
          impressions: d.impressions,
          ctr: d.ctr,
          position: d.position,
        },
      });
    }

    await prisma.syncCursor.upsert({
      where: { websiteId_dataset: { websiteId, dataset: "gsc_oauth" } },
      create: {
        websiteId,
        dataset: "gsc_oauth",
        lastCompleteDate: latestDate,
        lastRunAt: new Date(),
        lastStatus: "OK",
      },
      update: {
        lastCompleteDate: latestDate,
        lastRunAt: new Date(),
        lastStatus: "OK",
      },
    });

    // Update website timestamp
    await prisma.website.update({
      where: { id: websiteId },
      data: {
        lastGscSyncAt: new Date(),
        gscProperty: selectedProperty,
      },
    });

    // Recompute opportunity models
    await recomputeWebsiteOpportunities(websiteId);

    const totalRowsProcessed =
      dateRows.length +
      queryRows.length +
      pageRows.length +
      queryPageRows.length +
      countryRows.length +
      deviceRows.length;

    return {
      success: true,
      rowsProcessed: totalRowsProcessed,
      startDate,
      endDate,
    };
  } catch (err: unknown) {
    return {
      success: false,
      rowsProcessed: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
