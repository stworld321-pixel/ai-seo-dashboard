import type { Totals } from "@/lib/types";
import {
  getComparisonTotals,
  getDefaultWebsite,
  getSyncStatus,
  previousWindow,
  resolveWindow,
  type RangeKey,
  type Window,
} from "@/server/services/dashboard";

export const VALID_RANGES: RangeKey[] = ["7d", "28d", "90d", "6m", "12m"];

export function parseRange(searchParams: Record<string, string | string[] | undefined>): RangeKey {
  const raw = typeof searchParams.range === "string" ? searchParams.range : "28d";
  return VALID_RANGES.includes(raw as RangeKey) ? (raw as RangeKey) : "28d";
}

export type PageContext = {
  website: {
    id: string;
    name: string;
    url: string;
    automationLevel: number;
    gscProperty?: string | null;
    ga4PropertyId?: string | null;
    country?: string | null;
    lastGscSyncAt?: Date | null;
    lastGa4SyncAt?: Date | null;
  };
  window: Window;
  previous: Window;
  prevTotals: Totals;
  range: RangeKey;
  lastSyncedAt: Date | null;
  /** Whether the previous window has enough synced days for honest deltas. */
  canCompare: boolean;
  compareHint: string;
};

/**
 * Shared page bootstrap: resolve the website, the date window, and whether a
 * period-over-period comparison is actually defensible. Returns null when
 * there is no website or no data, so callers can render the right empty state.
 */
export async function loadPageContext(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<{ ctx: PageContext | null; reason: "no-website" | "no-data" | null; websiteName?: string }> {
  const range = parseRange(searchParams);
  const websiteId = typeof searchParams.website === "string" ? searchParams.website : undefined;

  const website = await getDefaultWebsite(websiteId);
  if (!website) return { ctx: null, reason: "no-website" };

  let window = await resolveWindow(website.id, range);
  if (!window) {
    try {
      const { ensureWebsiteAudited } = await import("@/server/services/ai-site-auditor");
      await ensureWebsiteAudited(website.id);
      window = await resolveWindow(website.id, range);
    } catch {
      // ignore
    }
  }
  if (!window) {
    const days = range === "7d" ? 7 : range === "90d" ? 90 : range === "6m" ? 182 : range === "12m" ? 365 : 28;
    const now = new Date();
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    window = { from, to, days };
  }

  const previous = previousWindow(window);
  const [prevResult, sync] = await Promise.all([
    getComparisonTotals(website.id, previous),
    getSyncStatus(website.id),
  ]);

  return {
    ctx: {
      website: {
        id: website.id,
        name: website.name,
        url: website.url,
        automationLevel: website.automationLevel,
        gscProperty: website.gscProperty ?? null,
        ga4PropertyId: website.ga4PropertyId ?? null,
        country: website.country ?? "IND",
        lastGscSyncAt: sync?.lastRunAt ?? null,
        lastGa4SyncAt: sync?.lastRunAt ?? null,
      },
      window,
      previous,
      prevTotals: prevResult.totals,
      range,
      lastSyncedAt: sync?.lastRunAt ?? null,
      canCompare: prevResult.complete,
      compareHint: prevResult.complete
        ? "vs previous period"
        : `baseline incomplete (${prevResult.daysCovered}/${previous.days} days synced)`,
    },
    reason: null,
  };
}
