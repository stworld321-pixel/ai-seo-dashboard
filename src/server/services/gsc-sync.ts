import { prisma } from "@/server/db";
import type { SearchDataProvider } from "@/server/integrations/search/provider";

/**
 * Incremental Search Console sync.
 *
 * Two rules drive the design (docs/07):
 *  1. Never re-request data we already hold — a SyncCursor per (website,
 *     dataset) records the last complete date.
 *  2. Always re-pull a trailing window, because Google finalises the most
 *     recent ~3 days late. Rows are upserted on their natural key, so a
 *     re-run is idempotent rather than duplicating.
 */

const TRAILING_RECHECK_DAYS = 3;
/** Google has no data for today or yesterday; start from 2 days back. */
const REPORTING_LAG_DAYS = 2;

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

export type SyncResult = {
  dataset: string;
  from: string;
  to: string;
  rowsFetched: number;
  rowsWritten: number;
};

export type SyncOptions = {
  websiteId: string;
  siteUrl: string;
  provider: SearchDataProvider;
  /** Override the start date; otherwise resumes from the cursor. */
  from?: string;
  to?: string;
  /** How far back to go on a first-ever sync. */
  backfillDays?: number;
};

async function resolveWindow(
  websiteId: string,
  dataset: string,
  opts: SyncOptions,
): Promise<{ from: Date; to: Date }> {
  const today = toDateOnly(new Date());
  const to = opts.to ? new Date(`${opts.to}T00:00:00Z`) : addDays(today, -REPORTING_LAG_DAYS);

  if (opts.from) return { from: new Date(`${opts.from}T00:00:00Z`), to };

  const cursor = await prisma.syncCursor.findUnique({
    where: { websiteId_dataset: { websiteId, dataset } },
  });

  if (!cursor?.lastCompleteDate) {
    return { from: addDays(to, -(opts.backfillDays ?? 90)), to };
  }
  // Re-pull the trailing window so late-finalised days are corrected.
  return { from: addDays(cursor.lastCompleteDate, -TRAILING_RECHECK_DAYS), to };
}

async function saveCursor(websiteId: string, dataset: string, to: Date, status: string) {
  await prisma.syncCursor.upsert({
    where: { websiteId_dataset: { websiteId, dataset } },
    create: { websiteId, dataset, lastCompleteDate: to, lastRunAt: new Date(), lastStatus: status },
    update: { lastCompleteDate: to, lastRunAt: new Date(), lastStatus: status },
  });
}

/** Totals by date. */
export async function syncGscDaily(opts: SyncOptions): Promise<SyncResult> {
  const dataset = "gsc:date";
  const { from, to } = await resolveWindow(opts.websiteId, dataset, opts);

  const rows = await opts.provider.query({
    siteUrl: opts.siteUrl,
    startDate: ymd(from),
    endDate: ymd(to),
    dimensions: ["date"],
  });

  let written = 0;
  for (const r of rows) {
    const date = new Date(`${r.keys[0]}T00:00:00Z`);
    await prisma.gscDaily.upsert({
      where: { websiteId_date: { websiteId: opts.websiteId, date } },
      create: {
        websiteId: opts.websiteId,
        date,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
      update: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position },
    });
    written++;
  }

  await saveCursor(opts.websiteId, dataset, to, "ok");
  return { dataset, from: ymd(from), to: ymd(to), rowsFetched: rows.length, rowsWritten: written };
}

/** Query grain, per date. */
export async function syncGscQueries(opts: SyncOptions): Promise<SyncResult> {
  const dataset = "gsc:query";
  const { from, to } = await resolveWindow(opts.websiteId, dataset, opts);

  const rows = await opts.provider.query({
    siteUrl: opts.siteUrl,
    startDate: ymd(from),
    endDate: ymd(to),
    dimensions: ["date", "query"],
  });

  let written = 0;
  for (const r of rows) {
    const date = new Date(`${r.keys[0]}T00:00:00Z`);
    const query = r.keys[1] ?? "";
    await prisma.gscQueryDaily.upsert({
      where: { websiteId_date_query: { websiteId: opts.websiteId, date, query } },
      create: {
        websiteId: opts.websiteId,
        date,
        query,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
      update: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position },
    });
    written++;
  }

  await saveCursor(opts.websiteId, dataset, to, "ok");
  return { dataset, from: ymd(from), to: ymd(to), rowsFetched: rows.length, rowsWritten: written };
}

/** Page grain, per date. */
export async function syncGscPages(opts: SyncOptions): Promise<SyncResult> {
  const dataset = "gsc:page";
  const { from, to } = await resolveWindow(opts.websiteId, dataset, opts);

  const rows = await opts.provider.query({
    siteUrl: opts.siteUrl,
    startDate: ymd(from),
    endDate: ymd(to),
    dimensions: ["date", "page"],
  });

  let written = 0;
  for (const r of rows) {
    const date = new Date(`${r.keys[0]}T00:00:00Z`);
    const page = r.keys[1] ?? "";
    await prisma.gscPageDaily.upsert({
      where: { websiteId_date_page: { websiteId: opts.websiteId, date, page } },
      create: {
        websiteId: opts.websiteId,
        date,
        page,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
      update: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position },
    });
    written++;
  }

  await saveCursor(opts.websiteId, dataset, to, "ok");
  return { dataset, from: ymd(from), to: ymd(to), rowsFetched: rows.length, rowsWritten: written };
}

/** country / device, per date. */
export async function syncGscDimension(
  opts: SyncOptions & { dimension: "country" | "device" },
): Promise<SyncResult> {
  const dataset = `gsc:${opts.dimension}`;
  const { from, to } = await resolveWindow(opts.websiteId, dataset, opts);

  const rows = await opts.provider.query({
    siteUrl: opts.siteUrl,
    startDate: ymd(from),
    endDate: ymd(to),
    dimensions: ["date", opts.dimension],
  });

  let written = 0;
  for (const r of rows) {
    const date = new Date(`${r.keys[0]}T00:00:00Z`);
    const value = r.keys[1] ?? "";
    await prisma.gscDimensionDaily.upsert({
      where: {
        websiteId_date_dimension_value: {
          websiteId: opts.websiteId,
          date,
          dimension: opts.dimension,
          value,
        },
      },
      create: {
        websiteId: opts.websiteId,
        date,
        dimension: opts.dimension,
        value,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
      update: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position },
    });
    written++;
  }

  await saveCursor(opts.websiteId, dataset, to, "ok");
  return { dataset, from: ymd(from), to: ymd(to), rowsFetched: rows.length, rowsWritten: written };
}

/**
 * Query + page grain. This is the dataset that makes opportunities actionable:
 * query-only data tells you "coconut milk soap ranks 8.8" but not WHICH page
 * ranks, so a "rewrite the title" recommendation has no target. Larger than the
 * other pulls, so it is synced over a shorter window by default.
 */
export async function syncGscQueryPages(opts: SyncOptions): Promise<SyncResult> {
  const dataset = "gsc:query_page";
  const { from, to } = await resolveWindow(opts.websiteId, dataset, opts);

  const rows = await opts.provider.query({
    siteUrl: opts.siteUrl,
    startDate: ymd(from),
    endDate: ymd(to),
    dimensions: ["date", "query", "page"],
  });

  let written = 0;
  for (const r of rows) {
    const date = new Date(`${r.keys[0]}T00:00:00Z`);
    const query = r.keys[1] ?? "";
    const page = r.keys[2] ?? "";
    await prisma.gscQueryPageDaily.upsert({
      where: {
        websiteId_date_query_page: { websiteId: opts.websiteId, date, query, page },
      },
      create: {
        websiteId: opts.websiteId,
        date,
        query,
        page,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
      update: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position },
    });
    written++;
  }

  await saveCursor(opts.websiteId, dataset, to, "ok");
  return { dataset, from: ymd(from), to: ymd(to), rowsFetched: rows.length, rowsWritten: written };
}

export async function syncAll(opts: SyncOptions): Promise<SyncResult[]> {
  return [
    await syncGscDaily(opts),
    await syncGscQueries(opts),
    await syncGscPages(opts),
    await syncGscQueryPages(opts),
    await syncGscDimension({ ...opts, dimension: "country" }),
    await syncGscDimension({ ...opts, dimension: "device" }),
  ];
}
