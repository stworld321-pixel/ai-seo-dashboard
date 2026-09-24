import type { QueryMetrics } from "@/lib/types";

/**
 * A site-fitted click-through-rate curve.
 *
 * Why fit instead of using a published industry curve: expected CTR varies
 * hugely by niche, brand strength and SERP features. The only honest baseline
 * for "is this listing underperforming?" is the site's own behaviour.
 *
 * When there is too little click data to fit (a brand-new site, or one with
 * zero clicks — which is the real state of litenatures.in today) we return
 * `null` from `expectedCtr()` rather than inventing a number. Callers must
 * handle null by reporting "no click data yet" instead of a fake gap.
 */

/** Minimum impressions in a position bucket before we trust its median CTR. */
const MIN_BUCKET_IMPRESSIONS = 20;
/** Minimum total clicks sitewide before any fit is attempted. */
const MIN_SITE_CLICKS = 30;

export type CtrCurve = {
  fitted: boolean;
  /** Expected CTR (fraction) at a given average position, or null if unfitted. */
  expectedCtr(position: number): number | null;
  /** Diagnostics for the UI so a user can see why a curve is/isn't available. */
  diagnostics: {
    totalClicks: number;
    totalImpressions: number;
    bucketsFitted: number;
  };
};

function bucketOf(position: number): number {
  // Positions are float averages; bucket to nearest integer rank, cap at 50.
  return Math.min(50, Math.max(1, Math.round(position)));
}

function weightedMedianCtr(rows: QueryMetrics[]): number {
  // Impression-weighted median is more robust than a mean against a single
  // high-impression outlier query dominating the bucket.
  const sorted = [...rows].sort((a, b) => a.ctr - b.ctr);
  const totalImp = sorted.reduce((s, r) => s + r.impressions, 0);
  if (totalImp === 0) return 0;
  let acc = 0;
  for (const r of sorted) {
    acc += r.impressions;
    if (acc >= totalImp / 2) return r.ctr;
  }
  return sorted[sorted.length - 1]!.ctr;
}

export function fitCtrCurve(rows: QueryMetrics[]): CtrCurve {
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);

  const buckets = new Map<number, QueryMetrics[]>();
  for (const r of rows) {
    const b = bucketOf(r.position);
    const list = buckets.get(b);
    if (list) list.push(r);
    else buckets.set(b, [r]);
  }

  const medians = new Map<number, number>();
  if (totalClicks >= MIN_SITE_CLICKS) {
    for (const [b, list] of buckets) {
      const imp = list.reduce((s, r) => s + r.impressions, 0);
      if (imp >= MIN_BUCKET_IMPRESSIONS) medians.set(b, weightedMedianCtr(list));
    }
  }

  const fitted = medians.size >= 3;

  return {
    fitted,
    diagnostics: {
      totalClicks,
      totalImpressions,
      bucketsFitted: medians.size,
    },
    expectedCtr(position: number): number | null {
      if (!fitted) return null;
      const b = bucketOf(position);
      // Smooth over +/-1 position to reduce bucket noise.
      const candidates = [b - 1, b, b + 1]
        .map((x) => medians.get(x))
        .filter((x): x is number => typeof x === "number");
      if (candidates.length > 0) {
        return candidates.reduce((s, x) => s + x, 0) / candidates.length;
      }
      // Bucket absent: interpolate from the nearest fitted buckets on each side.
      const keys = [...medians.keys()].sort((a, z) => a - z);
      const below = [...keys].reverse().find((k) => k < b);
      const above = keys.find((k) => k > b);
      if (below !== undefined && above !== undefined) {
        const t = (b - below) / (above - below);
        return medians.get(below)! * (1 - t) + medians.get(above)! * t;
      }
      if (below !== undefined) return medians.get(below)!;
      if (above !== undefined) return medians.get(above)!;
      return null;
    },
  };
}
