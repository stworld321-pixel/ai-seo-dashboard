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
  website: { id: string; name: string; url: string };
  window: Window;
  previous: Window;
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

  const website = await getDefaultWebsite();
  if (!website) return { ctx: null, reason: "no-website" };

  const window = await resolveWindow(website.id, range);
  if (!window) return { ctx: null, reason: "no-data", websiteName: website.name };

  const previous = previousWindow(window);
  const [prevResult, sync] = await Promise.all([
    getComparisonTotals(website.id, previous),
    getSyncStatus(website.id),
  ]);

  return {
    ctx: {
      website: { id: website.id, name: website.name, url: website.url },
      window,
      previous,
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
