/**
 * Core domain types shared by intelligence, services and UI.
 * Kept dependency-free so `intelligence/*` stays pure and unit-testable.
 */

export type SearchRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type DailyMetrics = {
  date: string; // YYYY-MM-DD
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type QueryMetrics = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  page?: string;
};

export type PageMetrics = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type Totals = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type OpportunityType =
  | "QUICK_WIN"
  | "PAGE_TWO"
  | "CTR_GAP"
  | "DECLINING_KEYWORD"
  | "DECLINING_PAGE"
  | "CONTENT_DECAY"
  | "CONTENT_GAP"
  | "CANNIBALIZATION"
  | "INTERNAL_LINK"
  | "SCHEMA_MISSING"
  | "AEO_GAP"
  | "TECHNICAL";

export type RecommendedAction = {
  action: string;
  detail?: string;
};

/**
 * Every opportunity must be explainable. `evidence` carries only numbers we
 * actually measured — never modelled or invented values.
 */
export type Opportunity = {
  type: OpportunityType;
  keyword?: string;
  targetUrl?: string;
  /** Raw comparable score used for ordering within a website. */
  score: number;
  /** 1 (highest) .. 5, assigned by percentile after scoring the whole set. */
  priority: number;
  /**
   * Modelled additional clicks per period. ALWAYS an estimate, and null when
   * the site has too little click data to fit a CTR curve.
   */
  estimatedClicks: number | null;
  /** Human sentence explaining the detection, rendered in the UI. */
  why: string;
  evidence: Record<string, number | string | boolean | null>;
  recommendation: RecommendedAction[];
};

export type Intent =
  | "INFORMATIONAL"
  | "COMMERCIAL"
  | "TRANSACTIONAL"
  | "NAVIGATIONAL"
  | "LOCAL";

export type Trend = "UP" | "FLAT" | "DOWN" | "NEW" | "LOST";
