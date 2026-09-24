import type { SearchRow } from "@/lib/types";

/**
 * Search Console data access, behind an interface so the Composio-backed
 * implementation used in Phase 1 can be swapped for native Google OAuth in
 * Phase 2 without touching anything above this layer.
 */

export type GscDimension =
  | "date"
  | "query"
  | "page"
  | "country"
  | "device"
  | "searchAppearance";

export type GscQueryParams = {
  siteUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions: GscDimension[];
  rowLimit?: number;
  startRow?: number;
  dataState?: "final" | "all";
};

export type GscProperty = {
  siteUrl: string;
  permissionLevel: string;
};

export type UrlInspection = {
  verdict: string | null;
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  lastCrawlTime: string | null;
  inspectionResultLink: string | null;
  raw: unknown;
};

export interface SearchDataProvider {
  listProperties(): Promise<GscProperty[]>;
  query(params: GscQueryParams): Promise<SearchRow[]>;
  inspectUrl(params: { siteUrl: string; inspectionUrl: string }): Promise<UrlInspection>;
}

/** Google caps a single Search Analytics response at 25,000 rows. */
export const GSC_MAX_ROW_LIMIT = 25000;
