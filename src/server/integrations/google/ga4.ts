/**
 * Official Google Analytics 4 (GA4) Direct API Client & Sync Engine.
 *
 * Calls: POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
 */

import { prisma } from "@/server/db";
import { getValidGoogleAccessToken } from "./oauth";

export type Ga4SyncResult = {
  success: boolean;
  totalUsers: number;
  totalSessions: number;
  totalPageViews: number;
  error?: string;
};

export async function syncDirectGoogleAnalytics4(
  websiteId: string,
  days: number = 28,
): Promise<Ga4SyncResult> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: {
      ga4Properties: { where: { isSelected: true } },
    },
  });

  if (!website) {
    return { success: false, totalUsers: 0, totalSessions: 0, totalPageViews: 0, error: "Website not found." };
  }

  const propertyId = website.ga4Properties[0]?.propertyId || website.ga4PropertyId;
  if (!propertyId) {
    return {
      success: false,
      totalUsers: 0,
      totalSessions: 0,
      totalPageViews: 0,
      error: "No GA4 Property ID selected for this website.",
    };
  }

  const accessToken = await getValidGoogleAccessToken(websiteId);
  if (!accessToken) {
    return {
      success: false,
      totalUsers: 0,
      totalSessions: 0,
      totalPageViews: 0,
      error: "Google Analytics is not connected. Connect via Google OAuth.",
    };
  }

  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "conversions" },
        ],
        dimensions: [{ name: "date" }, { name: "pagePath" }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        totalUsers: 0,
        totalSessions: 0,
        totalPageViews: 0,
        error: `GA4 API HTTP ${res.status}: ${errText}`,
      };
    }

    const data = (await res.json()) as {
      rows?: Array<{
        dimensionValues: Array<{ value: string }>;
        metricValues: Array<{ value: string }>;
      }>;
    };

    let totalUsers = 0;
    let totalSessions = 0;
    let totalPageViews = 0;

    for (const row of data.rows ?? []) {
      totalUsers += parseInt(row.metricValues[0]?.value || "0", 10);
      totalSessions += parseInt(row.metricValues[1]?.value || "0", 10);
      totalPageViews += parseInt(row.metricValues[2]?.value || "0", 10);
    }

    // Update website record
    await prisma.website.update({
      where: { id: websiteId },
      data: {
        lastGa4SyncAt: new Date(),
        ga4PropertyId: propertyId,
      },
    });

    return {
      success: true,
      totalUsers,
      totalSessions,
      totalPageViews,
    };
  } catch (err: unknown) {
    return {
      success: false,
      totalUsers: 0,
      totalSessions: 0,
      totalPageViews: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
