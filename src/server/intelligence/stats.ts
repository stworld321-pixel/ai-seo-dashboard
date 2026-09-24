/** Small statistics helpers used across the intelligence layer. */

/** Percentile of a numeric array (linear interpolation). p in [0,1]. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** Percentile RANK of `value` within `values`, returned in [0,1]. */
export function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return (below + equal / 2) / values.length;
}

/** Percentage change guarding division by zero. Returns null when base is 0. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/** Impression-weighted average position across rows. */
export function weightedPosition(
  rows: { impressions: number; position: number }[],
): number {
  const imp = rows.reduce((s, r) => s + r.impressions, 0);
  if (imp === 0) return 0;
  return rows.reduce((s, r) => s + r.position * r.impressions, 0) / imp;
}

/** Clamp helper. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
