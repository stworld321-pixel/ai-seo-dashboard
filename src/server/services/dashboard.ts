import { prisma } from "@/server/db";
import type { DailyMetrics, PageMetrics, QueryMetrics, Totals } from "@/lib/types";

/**
 * Read models for the dashboard. Everything here reads from OUR Postgres,
 * never from a live Google API call — so pages render fast and quota stays
 * bounded (docs/01 §5).
 */

export type RangeKey = "7d" | "28d" | "90d" | "6m" | "12m";

export const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "28d": 28,
  "90d": 90,
  "6m": 182,
  "12m": 365,
};

export type Window = { from: Date; to: Date; days: number };

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * Anchors the window on the latest date we actually hold data for, not on
 * today. Google lags ~2-3 days, so anchoring on today would silently show an
 * empty tail and make traffic look like it collapsed.
 */
export async function resolveWindow(
  websiteId: string,
  range: RangeKey,
): Promise<Window | null> {
  const latest = await prisma.gscDaily.findFirst({
    where: { websiteId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) return null;

  const to = dateOnly(latest.date);
  const days = RANGE_DAYS[range];
  return { from: addDays(to, -(days - 1)), to, days };
}

/** The equal-length window immediately before `w`, for period-over-period deltas. */
export function previousWindow(w: Window): Window {
  const to = addDays(w.from, -1);
  return { from: addDays(to, -(w.days - 1)), to, days: w.days };
}

function aggregate(rows: { clicks: number; impressions: number; position: number }[]): Totals {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const position =
    impressions > 0
      ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions
      : 0;
  return { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position };
}

export async function getDailySeries(
  websiteId: string,
  w: Window,
): Promise<DailyMetrics[]> {
  const rows = await prisma.gscDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export async function getTotals(websiteId: string, w: Window): Promise<Totals> {
  const rows = await prisma.gscDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    select: { clicks: true, impressions: true, position: true },
  });
  return aggregate(rows);
}

/**
 * Totals for a comparison window, plus whether we actually hold enough days to
 * make the comparison honest.
 *
 * This matters: with only 30 days backfilled, the "previous 28 days" contains
 * just 2 days of data, and naively comparing produced a headline delta of
 * +944% — pure artifact of missing history, not growth. When coverage is
 * incomplete we return `complete: false` and the UI shows no delta at all.
 */
export async function getComparisonTotals(
  websiteId: string,
  w: Window,
): Promise<{ totals: Totals; complete: boolean; daysCovered: number }> {
  const rows = await prisma.gscDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    select: { clicks: true, impressions: true, position: true },
  });
  // Require near-full coverage; a day or two of GSC gaps is normal.
  const complete = rows.length >= w.days - 1;
  return { totals: aggregate(rows), complete, daysCovered: rows.length };
}

/** Query-grain rollup over a window. */
export async function getQueryMetrics(
  websiteId: string,
  w: Window,
): Promise<QueryMetrics[]> {
  const rows = await prisma.gscQueryDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    select: { query: true, clicks: true, impressions: true, position: true },
  });

  const acc = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const r of rows) {
    const cur = acc.get(r.query) ?? { clicks: 0, impressions: 0, weighted: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weighted += r.position * r.impressions;
    acc.set(r.query, cur);
  }

  return [...acc.entries()]
    .map(([query, v]) => ({
      query,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.impressions > 0 ? v.weighted / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/** Page-grain rollup over a window. */
export async function getPageMetrics(
  websiteId: string,
  w: Window,
): Promise<PageMetrics[]> {
  const rows = await prisma.gscPageDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    select: { page: true, clicks: true, impressions: true, position: true },
  });

  const acc = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const r of rows) {
    const cur = acc.get(r.page) ?? { clicks: 0, impressions: 0, weighted: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weighted += r.position * r.impressions;
    acc.set(r.page, cur);
  }

  return [...acc.entries()]
    .map(([page, v]) => ({
      page,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.impressions > 0 ? v.weighted / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/** country / device breakdowns. */
export async function getDimension(
  websiteId: string,
  w: Window,
  dimension: "country" | "device",
): Promise<{ value: string; clicks: number; impressions: number; position: number }[]> {
  const rows = await prisma.gscDimensionDaily.findMany({
    where: { websiteId, dimension, date: { gte: w.from, lte: w.to } },
    select: { value: true, clicks: true, impressions: true, position: true },
  });

  const acc = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const r of rows) {
    const cur = acc.get(r.value) ?? { clicks: 0, impressions: 0, weighted: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weighted += r.position * r.impressions;
    acc.set(r.value, cur);
  }

  return [...acc.entries()]
    .map(([value, v]) => ({
      value,
      clicks: v.clicks,
      impressions: v.impressions,
      position: v.impressions > 0 ? v.weighted / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

export async function getDefaultWebsite() {
  return prisma.website.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function listWebsites() {
  return prisma.website.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getOpportunities(websiteId: string) {
  return prisma.opportunity.findMany({
    where: { websiteId, status: "OPEN" },
    orderBy: { score: "desc" },
  });
}

/** Last sync time across all datasets, for the "data freshness" indicator. */
export async function getSyncStatus(websiteId: string) {
  const cursors = await prisma.syncCursor.findMany({ where: { websiteId } });
  if (cursors.length === 0) return null;
  const lastRunAt = cursors
    .map((c) => c.lastRunAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const lastCompleteDate = cursors
    .map((c) => c.lastCompleteDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return { lastRunAt: lastRunAt ?? null, lastCompleteDate: lastCompleteDate ?? null, datasets: cursors.length };
}
