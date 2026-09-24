import fs from "node:fs";
import path from "node:path";
import type { PageMetrics, QueryMetrics, SearchRow } from "@/lib/types";

/**
 * Real Google Search Console data for litenatures.in, 2026-08-27 .. 2026-09-21,
 * pulled live via the Composio connector. Used as the primary test fixture so
 * the engine is validated against genuine data shapes (including the awkward
 * ones: zero clicks sitewide, positions above 50, single-impression queries).
 */

type CliResult = {
  results: { data?: { rows?: SearchRow[] } }[];
};

const FIXTURE = path.resolve(
  __dirname,
  "../../docs/sample-gsc-litenatures.json",
);

function load(): CliResult {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as CliResult;
}

/** Order of the parallel calls that produced the fixture. */
const INDEX = { query: 0, page: 1, country: 2, device: 3 } as const;

function rowsAt(i: number): SearchRow[] {
  return load().results[i]?.data?.rows ?? [];
}

export function liteQueries(): QueryMetrics[] {
  return rowsAt(INDEX.query).map((r) => ({
    query: r.keys[0]!,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export function litePages(): PageMetrics[] {
  return rowsAt(INDEX.page).map((r) => ({
    page: r.keys[0]!,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/**
 * A synthetic-but-plausible site WITH click history, used to exercise the code
 * paths that require a fitted CTR curve. Numbers are invented for testing only
 * and never reach the product.
 */
export function siteWithClicks(): QueryMetrics[] {
  const rows: QueryMetrics[] = [];
  const ctrAt = (p: number) => Math.max(0.005, 0.32 * Math.exp(-0.35 * (p - 1)));
  for (let p = 1; p <= 20; p++) {
    for (let k = 0; k < 4; k++) {
      const impressions = 400 - p * 10 + k * 7;
      const ctr = ctrAt(p);
      rows.push({
        query: `normal keyword p${p} v${k}`,
        impressions,
        ctr,
        clicks: Math.round(impressions * ctr),
        position: p + k * 0.1,
        page: `https://example.com/page-${p}`,
      });
    }
  }
  return rows;
}
